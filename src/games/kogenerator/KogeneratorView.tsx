import { Container, Graphics, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { KogeneratorParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { fmt } from '../../core/format';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, sparkline, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { HEAT_RATIO, HOURS, KogenSim, MIN_LOAD, SAMPLES_PER_HOUR, T_MAX, T_MIN } from './logic';
import { expose } from '../../testHooks';

const PRICE = 0xffd34d;
const HEATC = 0xff8a4f;
const hh = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function KogeneratorView(props: GameProps<KogeneratorParams>) {
  const sim = useMemo(() => new KogenSim(props.params), []);
  expose('kogen', sim);
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ money(v: number): void } | null>(null);
  const target = props.params.targetEur;

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      sim.on((e) => {
        switch (e.type) {
          case 'cold':
            audio.play('alarm');
            buzz([80, 40, 80]);
            setFlash((f) => f + 1);
            shake();
            showToast('Mrzli radiatorji! Dodaj toploto.', 'bad');
            break;
          case 'dump':
            audio.play('spark');
            showToast('Hladilnik meče toploto stran. Polni hranilnik!', 'bad');
            break;
          case 'spike':
            audio.play('coin');
            showToast(`Cenovni skok ob ${hh(e.spike.hour)}! Pripravi motor.`, 'good');
            break;
          case 'finished':
            finish();
            break;
        }
      }),
    [],
  );

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const profit = Math.round(sim.profit);
    const completed = profit >= target;
    audio.play(completed ? 'win' : 'fail');
    const eff = Math.round(sim.efficiency * 100);
    setTimeout(
      () =>
        props.onDone({
          kind: 'kogenerator',
          completed,
          mistakes: sim.coldEvents,
          timeLeft: 0,
          timeTotal: props.params.durationSec,
          score: Math.max(0, profit),
          metrics: { profit, efficiency: eff, dumped: Math.round(sim.dumpedKwh), cold: sim.coldEvents },
          failHint: completed ? undefined : `še ${fmt(target - profit)} € dobička`,
          notes: [
            `Elektrika: ${fmt(sim.elecKwh / 1000)} MWh, koristna toplota: ${fmt(sim.usefulHeatKwh / 1000)} MWh.`,
            sim.dumpedKwh > 50 ? `Zavrženo v hladilniku: ${fmt(sim.dumpedKwh)} kWh toplote. To je čisti strošek plina.` : 'Nič toplote ni šlo v hladilnik. Lepo!',
            `Skupni izkoristek ${eff} %. Dober CHP z izrabo toplote dosega 80–90 %.`,
          ],
          emoji: `🔥${sparkline(sim.day.price, 8)} ${profit >= target ? '💶' : '📉'} ${eff}%${sim.coldEvents ? ' 🥶'.repeat(Math.min(3, sim.coldEvents)) : ' ✨'}`,
        }),
      800,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const chart = new Graphics();
    const plant = new Graphics();
    const texts = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(chart, plant, texts, particles.layer, floaters.layer);

    const d = sim.day;
    const n = d.price.length;
    const pMax = Math.max(...d.price) * 1.1;
    const dMax = Math.max(...d.demand, props.params.chpKw * HEAT_RATIO) * 1.15;
    let W = 0;
    let H = 0;
    let chartH = 0;
    const pad = 12;
    const X = (h: number) => pad + (h / HOURS) * (W - pad * 2);
    const legend = label('cena elektrike', { fontSize: 11, fontWeight: '700', fill: PRICE });
    const legend2 = label('odjem toplote', { fontSize: 11, fontWeight: '700', fill: HEATC });
    const legend3 = label('tvoja elektrika', { fontSize: 11, fontWeight: '700', fill: COLORS.brand });
    const nowT = label('', { fontFamily: MONO, fontSize: 12, fontWeight: '800', fill: 0xffffff });
    nowT.anchor.set(0.5, 0);
    const priceT = label('', { fontFamily: MONO, fontSize: 12, fontWeight: '800', fill: PRICE });
    texts.addChild(legend, legend2, legend3, nowT, priceT);
    const hourTs: Text[] = [];
    for (const h of [0, 6, 12, 18, 24]) {
      const t = label(hh(h === 24 ? 0 : h), { fontSize: 10, fill: COLORS.muted });
      t.anchor.set(h === 0 ? 0 : h === 24 ? 1 : 0.5, 0);
      (t as Text & { hour?: number }).hour = h;
      hourTs.push(t);
      texts.addChild(t);
    }

    const layout = () => {
      W = app.screen.width;
      H = app.screen.height;
      chartH = Math.max(140, Math.min(H * 0.6, 280));
      legend.position.set(pad, 6);
      legend2.position.set(pad + legend.width + 12, 6);
      legend3.position.set(pad + legend.width + legend2.width + 24, 6);
      for (const t of hourTs) t.position.set(X((t as Text & { hour?: number }).hour!), chartH - 14);
    };

    fx.current = {
      money: (v) => floaters.add(`${v > 0 ? '+' : ''}${Math.round(v)} €`, W * 0.78, chartH + 28, v >= 0 ? COLORS.green : COLORS.red, 13),
    };

    // History of the player's electric output, one value per sample.
    const elecHist: number[] = [];
    let clock = 0;
    let lastProfit = 0;
    let moneyAcc = 0;
    const draw = () => {
      chart.clear();
      plant.clear();
      const top = 44;
      const bottom = chartH - 18;
      const Yp = (v: number) => bottom - (v / pMax) * (bottom - top);
      const Yd = (v: number) => bottom - (v / dMax) * (bottom - top);
      chart.roundRect(4, 0, W - 8, chartH, 14).fill({ color: 0x0a1028 }).stroke({ color: COLORS.line, width: 1 });
      // Night shading
      for (const [a, b] of [[0, 6], [22, 24]]) chart.rect(X(a), top, X(b) - X(a), bottom - top).fill({ color: 0x4f7dff, alpha: 0.06 });
      for (const s of d.spikes) chart.rect(X(s.hour), top, X(s.hour + s.len) - X(s.hour), bottom - top).fill({ color: PRICE, alpha: 0.1 + 0.05 * Math.sin(clock * 6) });
      // Heat demand as soft bars
      const bw = (W - pad * 2) / n;
      for (let i = 0; i < n; i++) chart.rect(pad + i * bw, Yd(d.demand[i]), bw + 0.5, bottom - Yd(d.demand[i])).fill({ color: HEATC, alpha: i / SAMPLES_PER_HOUR < sim.hour ? 0.16 : 0.28 });
      // Your electricity so far
      if (elecHist.length > 1) {
        chart.moveTo(X(0), bottom);
        elecHist.forEach((e, i) => chart.lineTo(X(i / SAMPLES_PER_HOUR), Yd(e * HEAT_RATIO)));
        chart.lineTo(X((elecHist.length - 1) / SAMPLES_PER_HOUR), bottom).closePath().fill({ color: COLORS.brand, alpha: 0.22 });
      }
      // Price line
      chart.moveTo(X(0), Yp(d.price[0]));
      for (let i = 1; i < n; i++) chart.lineTo(X(i / SAMPLES_PER_HOUR), Yp(d.price[i]));
      chart.stroke({ color: PRICE, width: 2.5, join: 'round' });
      // Now cursor
      const nx = X(sim.hour);
      chart.moveTo(nx, top - 6).lineTo(nx, bottom).stroke({ color: 0xffffff, width: 1.5, alpha: 0.7 });
      chart.circle(nx, Yp(sim.price), 5 + Math.sin(clock * 8)).fill({ color: PRICE });
      nowT.text = hh(sim.hour);
      nowT.position.set(Math.min(W - 30, Math.max(30, nx)), 24);
      priceT.text = `${sim.price} €/MWh`;
      priceT.anchor.set(nx > W * 0.7 ? 1.05 : -0.05, 0.5);
      priceT.position.set(nx, Yp(sim.price) - 12);

      // Plant schematic: storage ⇄ CHP → town, with the cooler on top of the engine.
      const py = chartH + (H - chartH) / 2;
      const s = Math.min(54, (H - chartH) * 0.55);
      const xS = W * 0.16;
      const xC = W * 0.5;
      const xT = W * 0.84;
      const f = sim.flow;
      const heatFull = props.params.chpKw * HEAT_RATIO;
      const pipe = (x0: number, x1: number, amount: number, color: number) => {
        plant.moveTo(x0, py).lineTo(x1, py).stroke({ color: 0x1b2654, width: 10, cap: 'round' });
        if (Math.abs(amount) < 1) return;
        const dir = Math.sign(amount);
        const speed = 40 + (Math.abs(amount) / heatFull) * 120;
        const span = Math.abs(x1 - x0);
        for (let k = 0; k < 6; k++) {
          const u = (((clock * speed) / span + k / 6) % 1 + 1) % 1;
          const x = dir > 0 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u;
          plant.circle(x, py, 3.5).fill({ color, alpha: 0.95 });
        }
      };
      pipe(xC + s * 0.6, xT - s * 0.55, f.demand, HEATC);
      pipe(xS + s * 0.5, xC - s * 0.6, -f.toStorage, f.toStorage > 0 ? 0x9fb6ff : HEATC);
      // Storage tank
      plant.roundRect(xS - s * 0.45, py - s * 0.75, s * 0.9, s * 1.5, 10).fill({ color: 0x0b1330 }).stroke({ color: 0x6f86d6, width: 2.5 });
      const lvl = s * 1.42 * sim.soc;
      plant.roundRect(xS - s * 0.41, py + s * 0.71 - lvl, s * 0.82, lvl, 7).fill({ color: HEATC, alpha: 0.75 });
      // CHP engine block shakes with load
      const shakeAmp = props.reducedMotion ? 0 : sim.controls.load * 1.6;
      const jx = Math.sin(clock * 50) * shakeAmp;
      plant.roundRect(xC - s * 0.6 + jx, py - s * 0.5, s * 1.2, s, 10).fill({ color: sim.controls.load > 0 ? 0x13305a : 0x141c40 }).stroke({ color: sim.controls.load > 0 ? COLORS.brand : 0x3a4785, width: 3 });
      for (let i = 0; i < 3; i++) {
        const ph = Math.sin(clock * 22 * sim.controls.load + i * 2.1);
        plant.rect(xC - s * 0.4 + i * s * 0.3 + jx, py - s * 0.2 + ph * s * 0.08 * (sim.controls.load > 0 ? 1 : 0), s * 0.18, s * 0.38).fill({ color: 0x2c4a86 });
      }
      // Cooler fan: spins red while heat is thrown away
      const fanY = py - s * 0.85;
      const dumping = f.dump > heatFull * 0.03;
      plant.circle(xC, fanY, s * 0.24).fill({ color: 0x0b1330 }).stroke({ color: dumping ? COLORS.red : 0x3a4785, width: 2 });
      const rot = clock * (dumping ? 16 : 0.4);
      for (let b = 0; b < 3; b++) {
        const a = rot + (b * Math.PI * 2) / 3;
        plant.moveTo(xC, fanY).lineTo(xC + Math.cos(a) * s * 0.2, fanY + Math.sin(a) * s * 0.2).stroke({ color: dumping ? COLORS.red : 0x5b6bb0, width: 3, cap: 'round' });
      }
      if (dumping && Math.random() < 0.4) particles.burst(xC, fanY - s * 0.2, COLORS.red, 1, 60, { gravity: -80, life: 0.7, size: 2 });
      // Electricity bolt up to the grid
      if (f.elec > 0) {
        const u = (clock * 2.5) % 1;
        plant.circle(xC + s * 0.62, py - s * 0.5 - u * s * 0.6, 3).fill({ color: PRICE });
      }
      // Town: houses glow warm or blue with frost
      const cold = sim.temp < T_MIN;
      for (let i = 0; i < 3; i++) {
        const hx = xT - s * 0.45 + i * s * 0.32;
        const hy = py + s * 0.2 - (i % 2) * s * 0.18;
        const c = cold ? 0x6fa8ff : 0xffb86b;
        plant.poly([hx - s * 0.14, hy - s * 0.12, hx, hy - s * 0.3, hx + s * 0.14, hy - s * 0.12]).fill({ color: 0x3a4785 });
        plant.rect(hx - s * 0.12, hy - s * 0.12, s * 0.24, s * 0.28).fill({ color: 0x1c2550 });
        plant.rect(hx - s * 0.05, hy - s * 0.05, s * 0.1, s * 0.1).fill({ color: c, alpha: 0.6 + 0.3 * Math.sin(clock * 3 + i) });
      }
    };

    layout();
    app.renderer.on('resize', layout);
    let hudAcc = 0;
    app.ticker.add((tk) => {
      const dt = Math.min(0.05, tk.deltaMS / 1000);
      clock += dt;
      if (!pausedRef.current && !sim.finished) {
        sim.update(dt);
        const idx = Math.floor(sim.hour * SAMPLES_PER_HOUR);
        while (elecHist.length <= idx && elecHist.length < n) elecHist.push(sim.flow.elec);
        moneyAcc += dt;
        if (moneyAcc > 1.5) {
          moneyAcc = 0;
          const delta = sim.profit - lastProfit;
          lastProfit = sim.profit;
          if (Math.abs(delta) >= 1) fx.current?.money(delta);
        }
        hudAcc += dt;
        if (hudAcc > 0.15) {
          hudAcc = 0;
          setFrame((x) => x + 1);
        }
      }
      particles.update(dt);
      floaters.update(dt);
      draw();
    });
    return () => {
      app.renderer.off('resize', layout);
      fx.current = null;
    };
  });

  const touched = () => {
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
  };
  const load = sim.controls.load;
  const st = sim.controls.storage;
  const temp = sim.temp;
  const tempPct = Math.max(0, Math.min(1, (temp - 55) / (100 - 55)));
  const tempState = temp < T_MIN ? 'cold' : temp >= T_MAX - 0.5 ? 'hot' : 'ok';
  const eff = Math.round(sim.efficiency * 100);
  const profit = Math.round(sim.profit);

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={props.params.durationSec * (1 - sim.hour / HOURS)} onPause={props.onPause}>
        <span class={`pill${profit >= target ? ' good' : ''}`} aria-label={`Dobiček ${profit} od ${target} evrov`}>
          {fmt(profit)}/{fmt(target)} €
        </span>
      </Hud>
      <div class="stage" ref={stageRef}>
        <div class="pixi-host" ref={host} />
        {flash > 0 && <div class="flash-red" key={flash} />}
        {toast && (
          <div class={`toast-line ${toast.kind}`} key={toast.id} role="status">
            {toast.text}
          </div>
        )}
        {tip && (
          <div class="hint">
            <GenkoSays text={tip} size={44} />
          </div>
        )}
      </div>
      <div class="kogen-gauges">
        <div class={`kg temp ${tempState}`} aria-label={`Temperatura omrežja ${Math.round(temp)} stopinj`}>
          <div class="kg-bar">
            <i class="band" style={{ bottom: `${((T_MIN - 55) / 45) * 100}%`, height: `${((T_MAX - T_MIN) / 45) * 100}%` }} />
            <i class="fill" style={{ height: `${tempPct * 100}%` }} />
          </div>
          <span>
            <b class="mono">{Math.round(temp)} °C</b>
            <small>omrežje</small>
          </span>
        </div>
        <div class="kg" aria-label={`Hranilnik ${Math.round(sim.soc * 100)} odstotkov`}>
          <div class="kg-bar tank">
            <i class="fill" style={{ height: `${sim.soc * 100}%` }} />
          </div>
          <span>
            <b class="mono">{Math.round(sim.soc * 100)} %</b>
            <small>hranilnik</small>
          </span>
        </div>
        <div class={`kg eff${eff >= 80 ? ' good' : eff > 0 && eff < 65 ? ' bad' : ''}`}>
          <span>
            <b class="mono">{eff ? `${eff} %` : '–'}</b>
            <small>izkoristek</small>
          </span>
        </div>
      </div>
      <div class="kogen-controls">
        <label class="slider">
          <span class="slider-head">
            <b>Kogenerator</b>
            <span class="mono">{load === 0 ? 'IZKLOP' : `${Math.round(load * 100)} % · ${fmt(load * props.params.chpKw)} kW`}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(load * 100)}
            aria-label="Moč kogeneratorja"
            onInput={(e) => {
              const v = Number((e.target as HTMLInputElement).value) / 100;
              const before = sim.controls.load;
              sim.setLoad(v);
              if ((before === 0) !== (sim.controls.load === 0)) audio.play(sim.controls.load ? 'on' : 'off');
              touched();
              setFrame((x) => x + 1);
            }}
          />
          <span class="slider-scale">
            <span>izklop</span>
            <span>min {MIN_LOAD * 100} %</span>
            <span>polna moč</span>
          </span>
        </label>
        <label class="slider storage">
          <span class="slider-head">
            <b>Hranilnik toplote</b>
            <span class="mono">{st === 0 ? 'MIRUJE' : st > 0 ? `POLNI ${Math.round(st * 100)} %` : `PRAZNI ${Math.round(-st * 100)} %`}</span>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            step={5}
            value={Math.round(st * 100)}
            aria-label="Hranilnik toplote: prazni ali polni"
            onInput={(e) => {
              sim.setStorage(Number((e.target as HTMLInputElement).value) / 100);
              touched();
              setFrame((x) => x + 1);
            }}
          />
          <span class="slider-scale">
            <span>◀ prazni v omrežje</span>
            <span>polni ▶</span>
          </span>
        </label>
      </div>
    </>
  );
}
