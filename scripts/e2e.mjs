// Automated playtest: drives the built game in a phone-sized Chromium with real pointer input.
// Usage: npm run build && npx vite preview --port 4173 & npm run e2e
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_URL ?? 'http://localhost:4173/';
const url = `${BASE}?e2e`;
const out = 'playtest';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const step = (msg) => console.log(`• ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};

const clearHooks = () =>
  page.evaluate(() => {
    delete window.__gr_priklop;
    delete window.__gr_konica;
    delete window.__gr_detektiv;
    delete window.__gr_wmbus;
    delete window.__gr_kogen;
  });
const startLevel = async () => {
  await clearHooks();
  await page.getByRole('button', { name: 'Igraj', exact: true }).click();
};

async function playPriklop() {
  await page.waitForFunction(() => window.__gr_priklop?.game);
  await wait(2300); // countdown
  const meters = await page.evaluate(() => window.__gr_priklop.game.puzzle.meters.map((m) => m.id));
  // Fix configuration through the real UI first, like a careful player.
  for (const id of meters) {
    const fix = await page.evaluate((id) => {
      const g = window.__gr_priklop.game;
      const m = g.puzzle.meters[id];
      const port = g.puzzle.ports[m.port];
      const taken = new Set(g.puzzle.meters.filter((o) => o.id !== id).map((o) => o.address));
      const needAddr = taken.has(m.address);
      let addr = m.address;
      if (needAddr) for (let a = 1; a <= 16; a++) if (!taken.has(a)) { addr = a; break; }
      return needAddr || m.baud !== port.baud ? { addr, baud: port.baud } : null;
    }, id);
    if (!fix) continue;
    await page.getByRole('button', { name: `Nastavi merilnik M${id + 1}` }).click();
    await page.getByRole('button', { name: new RegExp(`^Naslov ${fix.addr}(,|$)`) }).click();
    await page.getByRole('button', { name: String(fix.baud), exact: true }).click();
    await page.getByRole('button', { name: 'Shrani nastavitve' }).click();
    await wait(150);
  }
  const routes = await page.evaluate(() => {
    const { game, center, canvas } = window.__gr_priklop;
    const r = canvas.getBoundingClientRect();
    return game.puzzle.solution.map((route) => route.map((c) => {
      const p = center(c);
      return { x: r.left + p.x, y: r.top + p.y };
    }));
  });
  for (const route of routes) {
    await page.mouse.move(route[0].x, route[0].y);
    await page.mouse.down();
    for (const p of route.slice(1)) await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.mouse.up();
    await wait(120);
  }
}

async function playKonica(screenshotAt) {
  await page.waitForFunction(() => window.__gr_konica);
  await wait(2200);
  let shotDone = false;
  for (;;) {
    const st = await page.evaluate(() => {
      const s = window.__gr_konica;
      return {
        finished: s.finished,
        t: s.t,
        p: s.instantPower(),
        limit: s.limit,
        cs: s.consumers.map((c) => ({ id: c.def.id, name: c.def.name, on: c.on, buffer: c.buffer, crit: !!c.def.critical, active: c.active, locked: c.lockedFor > 0, kw: c.def.kw })),
      };
    });
    if (st.finished) break;
    if (!shotDone && st.t > screenshotAt) {
      await shot('konica-live');
      shotDone = true;
    }
    const tog = st.cs.filter((c) => !c.crit && c.active && !c.locked);
    const starving = tog.find((c) => !c.on && c.buffer < 0.22);
    let target = null;
    if (starving) {
      // Make room first, like a player who reads the graph.
      const donor = tog.filter((c) => c.on && c.buffer > 0.5).sort((a, b) => b.buffer - a.buffer)[0];
      if (donor && st.p + starving.kw * 1.5 > st.limit * 0.97) await page.getByRole('button', { name: new RegExp(`^${donor.name},`) }).click();
      target = starving;
    }
    else if (st.p > st.limit * 0.96) target = tog.filter((c) => c.on && c.buffer > 0.35).sort((a, b) => b.buffer - a.buffer)[0];
    else target = tog.filter((c) => !c.on && st.p + c.kw * 1.5 < st.limit * 0.93).sort((a, b) => a.buffer - b.buffer)[0];
    if (target) await page.getByRole('button', { name: new RegExp(`^${target.name},`) }).click();
    await wait(120);
  }
}

async function playDetektiv() {
  await page.waitForFunction(() => window.__gr_detektiv);
  await wait(2200);
  for (;;) {
    const st = await page.evaluate(() => {
      const g = window.__gr_detektiv;
      const canvas = document.querySelector('.pixi-host canvas');
      const r = canvas.getBoundingClientRect();
      const pxPerHour = r.width / 30;
      const ready = g.data.anomalies.find((a) => !a.found && !a.missed && g.cursor >= a.start + a.len);
      return { finished: g.finished, tap: ready ? { x: r.left + (ready.start + ready.len / 2 - g.viewStart) * pxPerHour, y: r.top + r.height / 2 } : null };
    });
    if (st.finished) break;
    if (st.tap) await page.mouse.click(st.tap.x, st.tap.y);
    await wait(150);
  }
}

async function playWmbus() {
  await page.waitForFunction(() => window.__gr_wmbus?.game);
  await wait(2300);
  const devices = await page.evaluate(() => {
    const { game, center, canvas } = window.__gr_wmbus;
    const r = canvas.getBoundingClientRect();
    return game.puzzle.solution.map((d) => ({ kind: d.kind, ...center(d), left: r.left, top: r.top }));
  });
  for (const d of devices) {
    await page.getByRole('radio', { name: d.kind === 'gateway' ? /^Prehod/ : /^Repetitor/ }).click();
    await page.mouse.click(d.left + d.x, d.top + d.y);
    await wait(200);
  }
}

async function playKogen(screenshotAt) {
  await page.waitForFunction(() => window.__gr_kogen);
  await wait(2200);
  const load = page.getByRole('slider', { name: 'Moč kogeneratorja' });
  const storage = page.getByRole('slider', { name: /Hranilnik toplote/ });
  let shotDone = false;
  let lastLoad = -1;
  let lastSt = -999;
  for (;;) {
    // Same policy as the balance bot, but through the real sliders.
    const st = await page.evaluate(() => {
      const s = window.__gr_kogen;
      const sorted = [...s.day.price].sort((a, b) => a - b);
      const threshold = Math.max(112.5 - 55 * 1.2 * 0.7, sorted[Math.floor(sorted.length * 0.45)]);
      const heatFull = s.p.chpKw * 1.2;
      const ahead = s.sample(s.day.demand, s.hour + 1);
      let load = s.price >= threshold ? 1 : 0;
      if (!load && s.soc < 0.12) load = Math.min(1, Math.max(0.4, (ahead * 1.05) / heatFull));
      const want = load * heatFull - s.demand + (s.temp - 80) * heatFull * 0.08;
      return { finished: s.finished, hour: s.hour, load: Math.round(load * 20) * 5, storage: Math.max(-100, Math.min(100, Math.round((want / s.storageMaxKw) * 20) * 5)) };
    });
    if (st.finished) break;
    if (!shotDone && st.hour > screenshotAt) {
      await shot('21-kogenerator');
      shotDone = true;
    }
    if (st.load !== lastLoad) await load.fill(String((lastLoad = st.load)));
    if (st.storage !== lastSt) await storage.fill(String((lastSt = st.storage)));
    await wait(100);
  }
}

async function resultStars() {
  await page.waitForSelector('.result');
  await wait(1800);
  return page.locator('.result .stars').getAttribute('aria-label');
}

// 1. First run and tutorial
await page.goto(url);
await wait(700);
await shot('01-title');
await page.getByRole('button', { name: 'Začni' }).click();
for (let i = 0; i < 3; i++) {
  await wait(250);
  await page.mouse.click(195, 760);
}
await wait(400);
step('tutorial finished, region screen');
await shot('02-region');

// 2. Level 1-1 Priklop
await page.getByRole('button', { name: /Stopnja 1: Prvi stik/ }).click();
await shot('03-intro');
await startLevel();
await playPriklop();
let stars = await resultStars();
step(`1-1 result: ${stars}`);
await shot('04-result-1');
if (!stars?.startsWith('3')) fail('1-1 should be 3 stars with perfect play');

// 3. Level 1-2 with address conflict, via "Naprej"
await page.getByRole('button', { name: /Naprej/ }).click();
await startLevel();
await wait(2400);
await shot('05-priklop-conflict');
await playPriklop();
stars = await resultStars();
step(`1-2 result: ${stars}`);
if (!stars?.startsWith('3')) fail('1-2 should be 3 stars with perfect play');

// 4. Level 1-3 Lov na konico
await page.getByRole('button', { name: /Naprej/ }).click();
await startLevel();
await playKonica(20);
stars = await resultStars();
step(`1-3 result: ${stars}`);
await shot('06-result-konica');
if (stars?.startsWith('0')) fail('1-3 should be beatable by the scripted player');
const litTag = await page.locator('text=Livarna je osvetljena').count();
if (!litTag) fail('Livarna should light up after 1-3');

// 5. Tabs
await page.getByRole('button', { name: 'Na zemljevid regije' }).click();
await wait(300);
await shot('07-region-lit');
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await wait(400);
await shot('08-map');
await page.getByRole('button', { name: 'Nadgradnje', exact: true }).click();
await wait(300);
await shot('09-upgrades');
const before = await page.evaluate(() => window.__gr_store.getState().upgrades.livarna ?? 0);
await page.locator('.upgrade').first().getByRole('button').click();
const after = await page.evaluate(() => window.__gr_store.getState().upgrades.livarna ?? 0);
step(`livarna upgrade ${before} → ${after}`);
if (after !== before + 1) fail('upgrade purchase did not apply');
await page.getByRole('button', { name: 'Zbirka', exact: true }).click();
await wait(300);
await shot('10-collection');
await page.getByRole('button', { name: /^Izziv/ }).click();
await wait(300);
await shot('11-daily-locked');
await page.getByRole('button', { name: 'Nastavitve' }).click();
await wait(300);
await shot('12-settings');
await page.getByRole('button', { name: 'Nazaj' }).click();

// 6. Persistence across reload
await wait(900);
await page.reload();
await wait(800);
const persisted = await page.evaluate(() => Object.keys(window.__gr_store.getState().levels).length);
step(`levels after reload: ${persisted}`);
if (persisted < 3) fail('progress was not persisted to IndexedDB');

// 7. Offline gain: rewind the idle clock by three hours
await page.evaluate(() => {
  const s = window.__gr_store.getState();
  window.__gr_store.setState({ lastTick: Date.now() - 3 * 3600_000 });
  s.tick(Date.now());
});
await page.getByRole('button', { name: 'Nadaljuj' }).click();
await wait(500);
await shot('13-offline-gain');
const offline = await page.locator('text=V tvoji odsotnosti').count();
if (!offline) fail('offline gain modal missing');
await page.getByRole('button', { name: 'Poberi' }).click();

// 8. Jump ahead: region 1 cleared, play Detektiv and the daily challenge
await page.evaluate(() => {
  const st = window.__gr_store.getState();
  const levels = { ...st.levels };
  for (let i = 1; i <= 10; i++) levels[`r1-${i}`] = levels[`r1-${i}`] ?? { stars: 2, best: 0, plays: 1 };
  window.__gr_store.setState({ levels, chips: st.chips + 5 });
});
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await page.getByRole('button', { name: /Mlekarna in prehrana/ }).click();
await wait(300);
await shot('14-unlock-region2');
await page.getByRole('button', { name: /Odkleni/ }).click();
await wait(400);
await page.getByRole('button', { name: /Stopnja 1: Kdo je pustil/ }).click();
await startLevel();
await wait(2200);
await wait(9000);
await shot('15-detektiv');
await playDetektiv();
stars = await resultStars();
step(`2-1 result: ${stars}`);
await shot('16-result-detektiv');
if (!stars?.startsWith('3')) fail('2-1 should be 3 stars with perfect play');

await page.getByRole('button', { name: 'Na zemljevid regije' }).click();
await page.getByRole('button', { name: /^Izziv/ }).click();
await wait(300);
await shot('17-daily');
await page.getByRole('button', { name: /Igraj današnji izziv/ }).click();
await startLevel();
await page.waitForFunction(() => window.__gr_priklop || window.__gr_konica || window.__gr_detektiv);
if (await page.evaluate(() => !!window.__gr_priklop)) await playPriklop();
else if (await page.evaluate(() => !!window.__gr_konica)) await playKonica(30);
else await playDetektiv();
stars = await resultStars();
step(`daily result: ${stars}`);
await shot('18-daily-result');

// 9. New regions: radio network and CHP
await page.locator('.result').getByRole('button', { name: 'Nazaj', exact: true }).click();
await page.evaluate(() => {
  const st = window.__gr_store.getState();
  const levels = { ...st.levels };
  for (const l of window.__gr_levels) if (l.region === 2) levels[l.id] = levels[l.id] ?? { stars: 2, best: 0, plays: 1 };
  window.__gr_store.setState({ levels, chips: st.chips + 20 });
});
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await page.getByRole('button', { name: /Komunala/ }).click();
await page.getByRole('button', { name: /Odkleni/ }).click();
await wait(500);
await shot('19-region3');
await page.getByRole('button', { name: /Stopnja 1: Tihi vodomeri/ }).click();
await startLevel();
await playWmbus();
stars = await resultStars();
step(`3-1 result: ${stars}`);
await shot('20-result-wmbus');
if (!stars?.startsWith('3')) fail('3-1 should be 3 stars with perfect play');

await page.evaluate(() => {
  const st = window.__gr_store.getState();
  const levels = { ...st.levels };
  for (const l of window.__gr_levels) if (l.region === 3) levels[l.id] = levels[l.id] ?? { stars: 2, best: 0, plays: 1 };
  window.__gr_store.setState({ levels });
});
await page.getByRole('button', { name: 'Na zemljevid regije' }).click();
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await page.getByRole('button', { name: /Kogeneracija/ }).click();
await page.getByRole('button', { name: /Odkleni/ }).click();
await wait(400);
await page.getByRole('button', { name: /Stopnja 1: Prvi zagon/ }).click();
await startLevel();
await playKogen(12);
stars = await resultStars();
step(`4-1 result: ${stars}`);
await shot('22-result-kogen');
if (stars?.startsWith('0')) fail('4-1 should be beatable through the sliders');

if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
await browser.close();
console.log(process.exitCode ? 'PLAYTEST FAILED' : 'PLAYTEST OK');
