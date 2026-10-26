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
    delete window.__gr_urnik;
    delete window.__gr_alarm;
    delete window.__gr_selitev;
  });
// Alarm!: tap whichever unit needs help and pick the fix the incident calls for.
const FIX = { vrata: 'zapri', izpad: 'agregat', kompresor: 'preseli', zmrzal: 'termostat', torba: 'vlozki' };
async function playAlarm(maxSec = 140) {
  await page.waitForFunction(() => window.__gr_alarm);
  const t0 = Date.now();
  while (Date.now() - t0 < maxSec * 1000) {
    const todo = await page.evaluate((FIX) => {
      const sim = window.__gr_alarm;
      if (!sim || sim.finished) return 'done';
      for (const x of sim.incidents) {
        if (!x.active || x.done) continue;
        const u = sim.units[x.unit];
        if (u.alarm || u.door || !u.power) return { unit: x.unit, action: FIX[x.cause] };
      }
      const g = sim.units.find((u) => u.alarm && !u.lost);
      return g ? { unit: g.id, action: 'lazni' } : null;
    }, FIX);
    if (todo === 'done') break;
    if (todo) {
      const ok = await page
        .locator(`.unit-card[data-unit="${todo.unit}"]`)
        .click({ timeout: 2000 })
        .then(() => true, () => false);
      const opt = page.locator(`.alarm-opt[data-action="${todo.action}"]`);
      if (ok && (await opt.count())) await opt.click();
      else if (await page.locator('.alarm-sheet .sheet-x').count()) await page.locator('.alarm-sheet .sheet-x').click();
    }
    await wait(250);
  }
  await page.waitForSelector('.result', { timeout: 15000 });
}

// Selitev: bin the bad records, convert Wh, send the rest to the right meter.
async function playSelitev(maxSec = 160) {
  await page.waitForFunction(() => window.__gr_selitev);
  const t0 = Date.now();
  while (Date.now() - t0 < maxSec * 1000) {
    const r = await page.evaluate(() => {
      const g = window.__gr_selitev;
      if (!g || g.finished) return 'done';
      const c = g.current;
      return c ? { id: c.id, bad: g.bad(c), wh: c.unit === 'Wh' && !g.converted, target: c.target } : null;
    });
    if (r === 'done') break;
    if (r) {
      // Between records the buttons are briefly disabled; just look again.
      const tap = (l) => l.click({ timeout: 1500 }).catch(() => {});
      if (r.bad) await tap(page.locator('.sel-bin'));
      else {
        if (r.wh) await tap(page.locator('.sel-convert'));
        await tap(page.locator('.sel-lane').nth(r.target));
      }
    }
    await wait(180);
  }
  await page.waitForSelector('.result', { timeout: 15000 });
}

// Story scenes pop up on first visits; the playtest watches the first one, then skips.
let storyShots = 0;
const skipStory = async () => {
  await wait(700);
  while (await page.locator('.story').count()) {
    if (storyShots++ < 1) {
      await wait(1500);
      await shot('02b-story');
    }
    await page.getByRole('button', { name: 'Preskoči' }).click();
    await wait(300);
  }
};
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
      const taken = new Set(g.puzzle.meters.filter((o) => o.id !== id).map((o) => o.address));
      const needAddr = taken.has(m.address);
      let addr = m.address;
      if (needAddr) for (let a = 1; a <= 16; a++) if (!taken.has(a)) { addr = a; break; }
      return needAddr ? { addr } : null;
    }, id);
    if (!fix) continue;
    await page.getByRole('button', { name: `Nastavi merilnik M${id + 1}` }).click();
    await page.getByRole('button', { name: new RegExp(`^Naslov ${fix.addr}(,|$)`) }).click();
    await page.getByRole('button', { name: 'Shrani nastavitve' }).click();
    await wait(150);
  }
  const routes = await page.evaluate(() => {
    const { game, center, canvas } = window.__gr_priklop;
    const r = canvas.getBoundingClientRect();
    return game.puzzle.solution.map((route) => route.map((c) => {
      const p = center(c);
      // The UI is drawn scaled down (zoom-out), so layout pixels are smaller on screen.
      const k = r.width / canvas.clientWidth;
      return { x: r.left + p.x * k, y: r.top + p.y * k };
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
      if (donor && st.p + starving.kw * 1.5 > st.limit * 0.97) await page.getByRole('button', { name: new RegExp(`^${donor.name},`) }).click({ timeout: 2000 }).catch(() => {});
      target = starving;
    }
    else if (st.p > st.limit * 0.96) target = tog.filter((c) => c.on && c.buffer > 0.35).sort((a, b) => b.buffer - a.buffer)[0];
    else target = tog.filter((c) => !c.on && st.p + c.kw * 1.5 < st.limit * 0.93).sort((a, b) => a.buffer - b.buffer)[0];
    // The round can end between reading the state and clicking.
    if (target) await page.getByRole('button', { name: new RegExp(`^${target.name},`) }).click({ timeout: 2000 }).catch(() => {});
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
    if (st.tap) {
      await page.mouse.click(st.tap.x, st.tap.y);
      const kind = await page.evaluate(() => window.__gr_detektiv.pending?.anomaly.kind);
      if (kind) await page.locator(`.diag-opt[data-kind="${kind}"]`).click();
    }
    await wait(150);
  }
}

async function playWmbus() {
  await page.waitForFunction(() => window.__gr_wmbus?.game);
  await wait(2300);
  const devices = await page.evaluate(() => {
    const { game, center, canvas } = window.__gr_wmbus;
    const r = canvas.getBoundingClientRect();
    const k = r.width / canvas.clientWidth;
    return game.puzzle.solution.map((d) => { const c = center(d); return { kind: d.kind, x: c.x * k, y: c.y * k, left: r.left, top: r.top }; });
  });
  for (const d of devices) {
    await page.getByRole('radio', { name: d.kind === 'gateway' ? /^Prehod/ : /^Repetitor/ }).click();
    await page.mouse.click(d.left + d.x, d.top + d.y);
    await wait(200);
  }
}

async function playUrnik() {
  await page.waitForFunction(() => window.__gr_urnik);
  await wait(2300);
  // Tap the known best plan through the real motor buttons, like a player who solved it.
  const cells = await page.evaluate(() => window.__gr_urnik.day.bestPlan.flatMap((row, u) => row.map((on, i) => (on ? [u, i] : null)).filter(Boolean)));
  for (const [u, i] of cells) {
    await page.locator(`.urn-motor button[data-unit="${u}"][data-block="${i}"]`).click();
    await wait(60);
  }
  await shot('21-urnik');
  await page.getByRole('button', { name: 'Zaženi dan ▶' }).click();
}

async function resultStars() {
  await page.waitForSelector('.result');
  // A facility lighting up, a boss KO or a taunt plays before the result appears.
  await skipStory();
  await page.waitForSelector('.result .stars');
  await wait(3400);
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
await skipStory();
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
await skipStory();
await startLevel();
await wait(2400);
await shot('05-priklop-conflict');
await playPriklop();
stars = await resultStars();
step(`1-2 result: ${stars}`);
if (!stars?.startsWith('3')) fail('1-2 should be 3 stars with perfect play');

// 4. Level 1-3 Lov na konico
await page.getByRole('button', { name: /Naprej/ }).click();
await skipStory();
await startLevel();
await playKonica(20);
stars = await resultStars();
step(`1-3 result: ${stars}`);
await shot('06-result-konica');
if (stars?.startsWith('0')) fail('1-3 should be beatable by the scripted player');
const litTag = await page.locator('text=Livarna je osvetljena').count();
if (!litTag) fail('Livarna should light up after 1-3');

// 5. Tabs
await page.locator('.result').getByRole('button', { name: /Zemljevid/ }).click();
await skipStory();
await shot('07-region-lit');
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await wait(400);
await shot('08-map');
await page.getByRole('button', { name: 'Nadgradnje', exact: true }).click();
await wait(300);
await shot('09-upgrades');
const before = await page.evaluate(() => window.__gr_store.getState().upgrades.livarna ?? 0);
await page.locator('.fac-buy').click();
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
await wait(400);
await shot('14a-map-region-ready');
if (!(await page.locator('.region-node.ready').count())) fail('unlockable region not highlighted');
await page.getByRole('button', { name: /Nova regija je pripravljena/ }).click();
await wait(300);
await shot('14-unlock-region2');
await page.getByRole('button', { name: /Odkleni za/ }).click();
await skipStory();
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

await page.locator('.result').getByRole('button', { name: /Zemljevid/ }).click();
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
await page.locator('.region-node').getByText('Komunala').click();
await page.getByRole('button', { name: /Odkleni/ }).click();
await skipStory();
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
await page.locator('.result').getByRole('button', { name: /Zemljevid/ }).click();
await page.getByRole('button', { name: 'Zemljevid', exact: true }).click();
await page.locator('.region-node').getByText('Kogeneracija').click();
await page.getByRole('button', { name: /Odkleni/ }).click();
await skipStory();
await page.getByRole('button', { name: /Stopnja 1: Prvi zagon/ }).click();
await startLevel();
await playUrnik();
stars = await resultStars();
step(`4-1 result: ${stars}`);
await shot('22-result-kogen');
if (stars?.startsWith('0')) fail('4-1 should be beatable by tapping the best plan');

// 10. Healthcare and the Dark Meter's centre
const jump = (id) =>
  page.evaluate((id) => {
    const st = window.__gr_store.getState();
    const levels = { ...st.levels };
    const region = Number(id[1]);
    for (const l of window.__gr_levels) if (l.region < region) levels[l.id] = levels[l.id] ?? { stars: 2, best: 0, plays: 1 };
    const seenTips = [...st.seenTips, 'scene:r5-intro', 'scene:r6-intro'];
    window.__gr_store.setState({ levels, regionsUnlocked: [1, 2, 3, 4, 5, 6], seenTips });
    const level = window.__gr_levels.find((l) => l.id === id);
    window.__gr_nav.getState().go({ name: 'play', level, from: { name: 'region', region } });
  }, id);
await clearHooks();
await jump('r5-1');
await skipStory();
await playAlarm();
stars = await resultStars();
step(`5-1 result: ${stars}`);
await shot('23-result-alarm');
if (!stars?.startsWith('3')) fail('5-1 should be 3 stars with prompt, correct responses');

await clearHooks();
await jump('r6-2');
await skipStory();
await playSelitev();
stars = await resultStars();
step(`6-2 result: ${stars}`);
await shot('24-result-selitev');
// A slow CI browser can let a record or two time out, so only a clean pass is required.
if (!stars || stars.startsWith('0') || stars.startsWith('1')) fail('6-2 should pass cleanly through the real buttons');

if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
await browser.close();
console.log(process.exitCode ? 'PLAYTEST FAILED' : 'PLAYTEST OK');
