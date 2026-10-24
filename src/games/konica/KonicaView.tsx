import { Container, Graphics, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { KonicaParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GENKO, pick } from '../../core/genko';
import { fmt } from '../../core/format';
import { ConsumerIcon } from '../../ui/components/Icons';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, sparkline, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { baselinePeak, KonicaSim, SAMPLE_DT, WINDOW_MIN } from './logic';
import { expose } from '../../testHooks';

const SLOWMO_FROM = 2.2;

export function KonicaView(props: GameProps<KonicaParams>) {
  const drainScale = Math.pow(0.88, props.research.rezervoar ?? 0);
  const forecast = (props.research.napoved ?? 0) > 0;
  const sim = useMemo(() => new KonicaSim(props.params, { drainScale }), []);
  const baseline = useMemo(() => baselinePeak(props.params), []);
  expose('konica', sim);
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ overBurst(): void } | null>(null);
  const warned = useRef(new Set<string>());

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    audio.startBeat(92);
    return () => audio.stopBeat();
  }, []);

  useEffect(() => {
    if (props.paused) audio.stopBeat();
    else if (!doneRef.current) audio.startBeat(audio.bpm);
  }, [props.paused]);

  useEffect(
    () =>
      sim.on((e) => {
        switch (e.type) {
          case 'toggle':
            audio.play(e.on ? 'on' : 'off');
            buzz(12);
            break;
          case 'refused':
            audio.play('blocked');
            showToast(e.reason === 'critical' ? 'Proizvodnja ne sme stati!' : e.reason === 'locked' ? 'Še se ponovno zaganja …' : 'Ta porabnik se še ni zagnal', 'bad');
            break;
          case 'stall': {
            const c = sim.consumers.find((x) => x.def.id === e.id)!;
            audio.play('alarm');
            buzz([80, 40, 80]);
            setFlash((f) => f + 1);
            showToast(`Zastoj! ${c.def.name}: ${c.def.bufferLabel?.toLowerCase() ?? 'zaloga'} na nič`, 'bad');
            break;
          }
          case 'overLimit':
            audio.play('spark');
            buzz(60);
            shake();
            setFlash((f) => f + 1);
            fx.current?.overBurst();
            showToast(pick(GENKO.peak), 'bad');
            break;
          case 'consumerStart': {
            const c = sim.consumers.find((x) => x.def.id === e.id)!;
            audio.play('alarm');
            showToast(`${c.def.name} se je zagnala`, 'bad');
            break;
          }
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
    audio.stopBeat();
    const passed = sim.passed;
    audio.play(passed ? 'win' : 'fail');
    const peak = Math.round(sim.peak);
    const saved = Math.max(0, Math.round(baseline - peak));
    setTimeout(
      () =>
        props.onDone({
          kind: 'konica',
          completed: passed,
          mistakes: sim.stalls,
          timeLeft: 0,
          timeTotal: sim.duration,
          score: saved * 10 + (sim.stalls === 0 ? 200 : 0),
          metrics: { peak, baseline: Math.round(baseline), saved, limit: sim.limit, overSeconds: Math.round(sim.overSeconds * 10) / 10 },
          failHint: passed ? undefined : `konica še ${Math.ceil(sim.peak - sim.limit * (1 + props.params.tolerance))} kW previsoka`,
          emoji: `📈${sparkline(sim.samples)}${passed ? (peak <= sim.limit ? '🟩' : '🟨') : '🟥'}`,
        }),
      800,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const grid = new Graphics();
    const area = new Graphics();
    const curve = new Graphics();
    const overlay = new Graphics();
    const texts = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(grid, area, curve, overlay, texts, particles.layer, floaters.layer);

    const p = props.params;
    const yMax = Math.max(baseline * 1.08, p.limitKw * 1.25);
    // Start the axis near the base load so the fight around the red line fills the screen.
    const yMin = Math.max(0, Math.floor((p.baseKw * 0.5) / 100) * 100);
    let W = 0;
    let H = 0;
    const padL = 12;
    const padR = 12;
    const padT = 64;
    const padB = 26;
    const X = (t: number) => padL + (t / p.durationSec) * (W - padL - padR);
    const Y = (kw: number) => padT + (1 - (Math.max(yMin, kw) - yMin) / (yMax - yMin)) * (H - padT - padB);

    const big = label('0 kW', { fontFamily: MONO, fontSize: 30, fontWeight: '800', fill: COLORS.green });
    big.position.set(14, 6);
    const sub = label('Trenutna moč · bela črta = obračunsko povprečje', { fontSize: 11, fill: COLORS.muted });
    sub.position.set(16, 42);
    const peakT = label('', { fontFamily: MONO, fontSize: 13, fontWeight: '700', fill: COLORS.text });
    peakT.anchor.set(1, 0);
    const limitT = label(`Obračunska moč ${p.limitKw} kW`, { fontSize: 11, fontWeight: '700', fill: COLORS.red });
    limitT.anchor.set(1, 1);
    texts.addChild(big, sub, peakT, limitT);
    const axis: Text[] = [];

    fx.current = {
      overBurst: () => particles.burst(X(sim.t), Y(sim.power), COLORS.red, 26, 260, { gravity: 200 }),
    };

    const layout = () => {
      W = app.screen.width;
      H = app.screen.height;
      grid.clear();
      for (const t of axis) t.destroy();
      axis.length = 0;
      for (let kw = yMin + 100; kw < yMax; kw += 100) grid.moveTo(padL, Y(kw)).lineTo(W - padR, Y(kw)).stroke({ color: COLORS.line, width: 1, alpha: 0.6 });
      for (let m = 0; m <= WINDOW_MIN; m += 5) {
        const x = X((m / WINDOW_MIN) * p.durationSec);
        grid.moveTo(x, padT).lineTo(x, H - padB).stroke({ color: COLORS.line, width: 1, alpha: 0.5 });
        const t = label(`${m}′`, { fontFamily: MONO, fontSize: 10, fill: COLORS.muted });
        t.anchor.set(m === 0 ? 0 : m === WINDOW_MIN ? 1 : 0.5, 0);
        t.position.set(x, H - padB + 6);
        texts.addChild(t);
        axis.push(t);
      }
      peakT.position.set(W - 14, 12);
      limitT.position.set(W - padR - 2, Y(p.limitKw) - 4);
    };

    let clock = 0;
    let lastBpm = 0;
    const draw = () => {
      const s = sim.samples;
      area.clear();
      curve.clear();
      overlay.clear();
      const ly = Y(p.limitKw);
      // limit line with glow
      overlay.moveTo(padL, ly).lineTo(W - padR, ly).stroke({ color: COLORS.red, width: 6, alpha: 0.15 });
      overlay.moveTo(padL, ly).lineTo(W - padR, ly).stroke({ color: COLORS.red, width: 2, alpha: 0.9 });
      if (s.length > 1) {
        const step = Math.max(1, Math.floor(s.length / 600));
        area.moveTo(X(0), Y(yMin));
        for (let i = 0; i < s.length; i += step) area.lineTo(X(i * SAMPLE_DT), Y(s[i]));
        area.lineTo(X((s.length - 1) * SAMPLE_DT), Y(yMin)).closePath().fill({ color: COLORS.green, alpha: 0.08 });
        // Curve coloured per segment: green under the line, red above.
        for (let i = step; i < s.length; i += step) {
          const a = s[i - step];
          const b = s[i];
          const over = Math.max(a, b) > p.limitKw;
          curve.moveTo(X((i - step) * SAMPLE_DT), Y(a)).lineTo(X(i * SAMPLE_DT), Y(b)).stroke({ color: over ? COLORS.red : COLORS.green, width: 3, cap: 'round' });
        }
        // Billing average: what the utility will actually charge.
        const b = sim.billed;
        overlay.moveTo(X(0), Y(b[0]));
        for (let i = step; i < b.length; i += step) overlay.lineTo(X(i * SAMPLE_DT), Y(b[i]));
        overlay.stroke({ color: 0xffffff, width: 1.5, alpha: 0.55 });
        const peakIdx = b.indexOf(Math.max(...b));
        overlay.circle(X(peakIdx * SAMPLE_DT), Y(b[peakIdx]), 4).fill({ color: 0xffffff });
      }
      const hx = X(sim.t);
      const hy = Y(sim.power);
      overlay.moveTo(hx, padT).lineTo(hx, H - padB).stroke({ color: COLORS.brand, width: 1, alpha: 0.4 });
      overlay.circle(hx, hy, 9 + Math.sin(clock * 8) * 2).fill({ color: sim.over ? COLORS.red : COLORS.green, alpha: 0.25 });
      overlay.circle(hx, hy, 4.5).fill({ color: 0xffffff });
      if (forecast && !sim.finished) {
        // Forecast assumes the current switch states hold.
        let px = hx;
        let py = hy;
        const draws = sim.consumers.reduce((sum, c) => sum + (c.active && c.on ? c.def.kw : 0), 0);
        for (let k = 1; k <= 12; k++) {
          const t = sim.t + k * 0.25;
          if (t > p.durationSec) break;
          let extra = 0;
          for (const c of sim.consumers) if (!c.active && c.def.startAt !== undefined && t >= c.def.startAt) extra += c.def.kw;
          const kw = (sim.baseAt(t) + draws + extra) * sim.ramp(t);
          const nx = X(t);
          const ny = Y(kw);
          if (k % 2 === 1) overlay.moveTo(px, py).lineTo(nx, ny).stroke({ color: kw > p.limitKw ? COLORS.orange : COLORS.brand, width: 2, alpha: 0.7 });
          px = nx;
          py = ny;
        }
      }
      big.text = `${Math.round(sim.power)} kW`;
      big.style.fill = sim.power > p.limitKw ? COLORS.red : sim.power > p.limitKw * 0.94 ? COLORS.orange : COLORS.green;
      peakT.text = `Obračunska konica ${Math.round(sim.peak)} kW`;
      peakT.style.fill = sim.peak > p.limitKw ? COLORS.red : COLORS.text;
      // Tempo rises with time and with danger.
      const bpm = Math.round(92 + (sim.t / p.durationSec) * 60 + (sim.over ? 24 : 0));
      if (Math.abs(bpm - lastBpm) >= 4) {
        audio.bpm = bpm;
        lastBpm = bpm;
      }
    };

    layout();
    app.renderer.on('resize', layout);
    let hudAcc = 0;
    app.ticker.add((tk) => {
      let dt = Math.min(0.05, tk.deltaMS / 1000);
      clock += dt;
      if (!pausedRef.current && !sim.finished) {
        // Last seconds run in slow motion for drama.
        if (sim.timeLeft < SLOWMO_FROM) dt *= 0.45;
        sim.update(dt);
        hudAcc += dt;
        if (hudAcc > 0.1) {
          hudAcc = 0;
          setFrame((f) => f + 1);
        }
        const soon = sim.upcoming();
        if (soon && soon.in < 4 && !warned.current.has(soon.def.id)) {
          warned.current.add(soon.def.id);
          showToast(`${soon.def.name} se zažene čez ${Math.ceil(soon.in)} s!`, 'bad');
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

  const toggle = (id: string) => {
    if (pausedRef.current) return;
    audio.unlock();
    sim.toggle(id);
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
    setFrame((f) => f + 1);
  };

  const slow = sim.timeLeft < SLOWMO_FROM && !sim.finished;
  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={sim.timeLeft} onPause={props.onPause} />
      <div class="stage" ref={stageRef}>
        <div class="pixi-host" ref={host} />
        {slow && !props.reducedMotion && <div class="vignette-slow" />}
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
      <div class="consumers">
        {sim.consumers.map((c) => {
          const pct = Math.round(c.buffer * 100);
          const pending = !c.active;
          const cls = [
            'consumer',
            c.def.critical ? 'critical' : '',
            pending ? 'pending' : c.on ? 'on' : 'off',
            !c.def.critical && !c.on && c.buffer < 0.3 ? 'warn' : '',
            c.lockedFor > 0 ? 'locked' : '',
          ].join(' ');
          const startIn = c.def.startAt !== undefined ? Math.max(0, Math.ceil(c.def.startAt - sim.t)) : 0;
          return (
            <button class={cls} onClick={() => toggle(c.def.id)} aria-pressed={c.on} aria-label={`${c.def.name}, ${c.on ? 'vklopljen' : 'izklopljen'}`}>
              {!c.def.critical && <span class="switch" />}
              <span class="consumer-name">
                <ConsumerIcon name={c.def.icon} />
                {c.def.name}
              </span>
              <span class="consumer-kw">{pending ? `Zagon čez ${startIn} s` : `${fmt(c.draw * sim.ramp(sim.t))} kW`}</span>
              {c.def.critical ? (
                <span class="buffer-label">Proizvodnja · ne sme stati</span>
              ) : (
                <>
                  <span class={`buffer${pct < 30 ? ' crit' : pct < 55 ? ' low' : ''}`}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span class="buffer-label">{c.lockedFor > 0 ? `Zastoj · ponovni zagon ${Math.ceil(c.lockedFor)} s` : `${c.def.bufferLabel} ${pct} %`}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
