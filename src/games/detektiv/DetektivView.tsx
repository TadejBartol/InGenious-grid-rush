import { Container, Graphics, type FederatedPointerEvent, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AnomalyKind, DetektivParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { DAY_NAMES } from '../../data/profiles';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, sparkline, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { ANOMALY_INFO, DetektivGame, DIAGNOSE_SEC, POINTS, VIEW_HOURS } from './logic';
import { expose } from '../../testHooks';
import { plural } from '../../core/balance';

/** Load signatures drawn on the diagnosis buttons: the shape each cause leaves on the chart. */
const GLYPH: Record<AnomalyKind, string> = {
  nocna: 'M2 20 H14 V9 H46 V20 H58',
  zrak: 'M2 20 H12 V12 H58',
  prazniTek: 'M2 20 H8 V7 H14 V19 H20 V7 H26 V19 H32 V7 H38 V19 H44 V20 H58',
  konica: 'M2 20 H22 L27 3 L32 13 L35 20 H58',
  hladilnik: 'M2 20 H12 L46 6 V20 H58',
};

const AMBER = 0xffd23f;

export function DetektivView(props: GameProps<DetektivParams>) {
  const ai = (props.research.ai ?? 0) > 0;
  const game = useMemo(() => new DetektivGame(props.params, { diagnoseSec: DIAGNOSE_SEC + 2 * (props.research.kalibracija ?? 0) }), []);
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  /** The diagnosis sheet opens on the half of the chart away from the tapped spot. */
  const [diagTop, setDiagTop] = useState(false);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ found(hour: number, text: string, color: number): void; wrong(x: number, y: number): void } | null>(null);
  const total = game.data.anomalies.length;
  expose('detektiv', game);

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      game.on((e) => {
        const mid = (x: { start: number; len: number }) => x.start + x.len / 2;
        switch (e.type) {
          case 'suspect':
            audio.play('step');
            buzz(15);
            break;
          case 'found':
            audio.play('found');
            if (e.combo >= 3) setTimeout(() => audio.play('coin'), 120);
            buzz(20);
            fx.current?.found(mid(e.anomaly), `${e.combo >= 3 ? `COMBO ×${e.combo}  ` : ''}+${e.points / 10} DP${e.fast ? ' ⚡' : ''}`, COLORS.green);
            showToast(e.fast ? `${ANOMALY_INFO[e.anomaly.kind].name} · hitro odkrito!` : `Pravilno: ${ANOMALY_INFO[e.anomaly.kind].name}`, 'good');
            break;
          case 'misread':
            audio.play('wrong');
            buzz([30, 30, 30]);
            fx.current?.found(mid(e.anomaly), '+2,5 DP', AMBER);
            showToast(e.picked ? `Ne, to je bila ${ANOMALY_INFO[e.anomaly.kind].name.toLowerCase()}.` : `Prepozno. Bila je ${ANOMALY_INFO[e.anomaly.kind].name.toLowerCase()}.`, 'bad');
            break;
          case 'decoy':
            audio.play('wrong');
            buzz([30, 30, 30]);
            shake();
            showToast(`Po urniku: ${e.decoy.name}. To je bilo načrtovano.`, 'bad');
            break;
          case 'wrong':
            audio.play('wrong');
            buzz([30, 30, 30]);
            shake();
            showToast('To je normalno obratovanje.', 'bad');
            break;
          case 'missed':
            showToast(`Spregledano: ${ANOMALY_INFO[e.anomaly.kind].name}`, 'bad');
            break;
          case 'finished':
            finish();
            break;
        }
        setFrame((f) => f + 1);
      }),
    [],
  );

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const found = game.foundCount;
    const need = Math.ceil(total * 0.6);
    const completed = found >= need;
    audio.play(completed ? 'win' : 'fail');
    const when = (h: number) => `${DAY_NAMES[Math.floor(h / 24)]} ${String(h % 24).padStart(2, '0')}:00`;
    const notes = [
      ...game.data.anomalies.map(
        (a) => `${a.found ? (a.misread ? '◐' : '✓') : '✗'} ${ANOMALY_INFO[a.kind].name} (${when(a.start)})${a.misread ? ' – napačen vzrok' : ''} – ${ANOMALY_INFO[a.kind].why}`,
      ),
      ...game.data.decoys.filter((d) => d.accused).map((d) => `✗ ${d.name} (${when(d.start)}) je bil na urniku – ni anomalija.`),
    ];
    // Everything above 100 per correct find (combos, early finds) becomes bonus DP.
    const bonusDp = Math.max(0, Math.round((game.points - game.readCount * 100) / 10));
    setTimeout(
      () =>
        props.onDone({
          kind: 'detektiv',
          completed,
          mistakes: game.mistakes,
          timeLeft: 0,
          timeTotal: props.params.durationSec,
          score: game.points,
          metrics: { found, missed: total - found, total, bonusDp, bestCombo: game.bestCombo, read: game.readCount, fast: game.fastFinds },
          failHint: completed ? undefined : `še ${need - found} ${plural(need - found, 'anomalija', 'anomaliji', 'anomalije', 'anomalij')}`,
          emoji: `🔎${game.data.anomalies.map((a) => (a.found ? (a.misread ? '🟨' : '🟩') : '🟥')).join('')}${game.mistakes ? '❌'.repeat(Math.min(3, game.mistakes)) : '✨'} ${sparkline(game.data.actual, 7)}`,
          notes,
        }),
      800,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const bands = new Graphics();
    const area = new Graphics();
    const lines = new Graphics();
    const marks = new Graphics();
    const plan = new Graphics();
    const texts = new Container();
    const planTexts = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(bands, area, lines, marks, plan, planTexts, texts, particles.layer, floaters.layer);

    const d = game.data;
    const yMax = Math.max(...d.actual, ...d.normal) * 1.1;
    const spread = props.params.noise + 0.05;
    let W = 0;
    let H = 0;
    const padT = 58;
    const padB = 30;
    const planY = 24;
    let pxPerHour = 1;
    const X = (h: number) => (h - game.viewStart) * pxPerHour;
    const Y = (kw: number) => padT + (1 - kw / yMax) * (H - padT - padB);
    const dayTexts: Text[] = [];
    const planTitle = label('URNIK', { fontFamily: MONO, fontSize: 10, fontWeight: '800', fill: COLORS.muted, letterSpacing: 1 });
    planTitle.position.set(8, planY - 13);
    const nowT = label('', { fontFamily: MONO, fontSize: 11, fontWeight: '700', fill: COLORS.brand });
    nowT.anchor.set(1, 0);
    texts.addChild(planTitle, nowT);
    for (let day = 0; day < 7; day++) {
      const t = label(DAY_NAMES[day], { fontSize: 11, fontWeight: '700', fill: day >= 5 ? COLORS.orange : COLORS.muted });
      t.anchor.set(0.5, 0);
      dayTexts.push(t);
      texts.addChild(t);
    }
    const planLabels = d.decoys.map((dc) => {
      const t = label(`📅 ${dc.name}`, { fontSize: 11, fontWeight: '700', fill: 0xc9d6ff });
      t.anchor.set(0, 0.5);
      planTexts.addChild(t);
      return t;
    });
    const tagLabels = d.anomalies.map(() => {
      const t = label('', { fontSize: 10, fontWeight: '800', fill: COLORS.green });
      t.anchor.set(0.5, 0);
      t.visible = false;
      texts.addChild(t);
      return t;
    });

    const layout = () => {
      W = app.screen.width;
      H = app.screen.height;
      pxPerHour = W / VIEW_HOURS;
    };

    fx.current = {
      found: (hour, text, color) => {
        const x = X(hour);
        const y = Y(d.actual[Math.floor(hour)] ?? 0);
        particles.burst(x, y, color, 26, 220, { gravity: 0, life: 0.8 });
        floaters.add(text, x, y - 26, color, 15);
      },
      wrong: (x, y) => particles.burst(x, y, COLORS.red, 14, 160, { gravity: 300 }),
    };

    let clock = 0;
    const draw = () => {
      bands.clear();
      area.clear();
      lines.clear();
      marks.clear();
      plan.clear();
      const start = game.viewStart;
      const end = Math.min(POINTS, start + VIEW_HOURS + 1);
      const cur = game.cursor;
      const bottom = H - padB;
      // Night and weekend shading: where consumption should be low.
      for (let h = Math.floor(start); h < end; h++) {
        const hour = h % 24;
        const day = Math.floor(h / 24);
        const night = hour >= 22 || hour < 6;
        if (day >= 5) bands.rect(X(h), padT, pxPerHour + 0.5, bottom - padT).fill({ color: COLORS.orange, alpha: 0.05 });
        if (night) bands.rect(X(h), padT, pxPerHour + 0.5, bottom - padT).fill({ color: 0x4f7dff, alpha: 0.08 });
        if (hour === 0) bands.moveTo(X(h), padT - 4).lineTo(X(h), bottom).stroke({ color: COLORS.line, width: 1 });
      }
      for (let k = 1; k < 4; k++) bands.moveTo(0, padT + ((bottom - padT) * k) / 4).lineTo(W, padT + ((bottom - padT) * k) / 4).stroke({ color: COLORS.line, width: 1, alpha: 0.35 });
      dayTexts.forEach((t, day) => {
        const x = X(day * 24 + 12);
        t.visible = x > -20 && x < W + 20;
        t.position.set(x, bottom + 8);
      });

      // Production schedule: planned events are known ahead, so they show for the future too.
      planTitle.visible = d.decoys.length > 0;
      if (d.decoys.length) plan.roundRect(0, planY - 9, W, 18, 9).fill({ color: COLORS.panel, alpha: 0.9 });
      d.decoys.forEach((dc, k) => {
        const x0 = X(dc.start - 0.5);
        const x1 = X(dc.start + dc.len - 0.5);
        const vis = x1 > 0 && x0 < W;
        planLabels[k].visible = vis;
        if (!vis) return;
        plan.roundRect(x0, planY - 8, x1 - x0, 16, 8).fill({ color: dc.accused ? COLORS.red : 0x4f7dff, alpha: dc.accused ? 0.45 : 0.55 });
        plan.rect(x0, planY + 8, x1 - x0, bottom - planY - 8).fill({ color: 0x4f7dff, alpha: 0.05 });
        planLabels[k].position.set(Math.max(4, x0 + 6), planY);
      });

      // Expected corridor around the typical week: inside it everything is fine.
      const h0 = Math.floor(start);
      // Drawn hour by hour: one simple quad each keeps the fill clean where the load jumps.
      for (let h = h0; h < end - 1; h++) {
        const a = d.normal[h];
        const b = d.normal[h + 1];
        lines
          .poly([X(h), Y(a * (1 + spread)), X(h + 1), Y(b * (1 + spread)), X(h + 1), Y(b * (1 - spread)), X(h), Y(a * (1 - spread))])
          .fill({ color: 0xc9d6ff, alpha: 0.08 });
      }
      lines.moveTo(X(h0), Y(d.normal[h0]));
      for (let h = h0; h < end; h++) lines.lineTo(X(h), Y(d.normal[h]));
      lines.stroke({ color: 0xc9d6ff, width: 1.5, alpha: 0.4 });

      for (const [k, a] of d.anomalies.entries()) {
        const tag = tagLabels[k];
        tag.visible = false;
        if (a.start > cur) continue;
        const x0 = X(a.start - 0.5);
        const x1 = X(a.start + a.len - 0.5);
        const pending = game.pending?.anomaly === a;
        if (pending) {
          const pulse = 0.16 + 0.08 * Math.sin(clock * 10);
          bands.roundRect(x0 - 4, padT, x1 - x0 + 8, bottom - padT, 8).fill({ color: AMBER, alpha: pulse }).stroke({ color: AMBER, width: 2 });
        } else if (a.found) {
          const c = a.misread ? AMBER : COLORS.green;
          bands.roundRect(x0, padT, x1 - x0, bottom - padT, 6).fill({ color: c, alpha: 0.13 }).stroke({ color: c, width: 1.5, alpha: 0.7 });
          tag.text = a.misread ? '?' : ANOMALY_INFO[a.kind].name;
          tag.style.fill = c;
          tag.position.set((x0 + x1) / 2, padT + 4);
          tag.visible = true;
        } else if (a.missed) bands.roundRect(x0, padT, x1 - x0, bottom - padT, 6).stroke({ color: COLORS.red, width: 1.5, alpha: 0.6 });
        else if (ai && cur > a.start + a.len + 1.5) bands.roundRect(x0, padT, x1 - x0, bottom - padT, 6).fill({ color: COLORS.brand, alpha: 0.05 + 0.05 * Math.sin(clock * 5) });
      }

      if (cur > start) {
        const last = Math.min(Math.floor(cur), POINTS - 1);
        const frac = Math.min(1, cur - last);
        // The head glides between hours so the line moves smoothly, right up to the last second.
        const headH = last + (last < POINTS - 1 ? frac : 0);
        const headKw = last < POINTS - 1 ? d.actual[last] + (d.actual[last + 1] - d.actual[last]) * frac : d.actual[last];
        const pts: [number, number][] = [];
        for (let h = h0; h <= last; h++) pts.push([X(h), Y(d.actual[h])]);
        pts.push([X(headH), Y(headKw)]);
        area.moveTo(pts[0][0], bottom);
        for (const [x, y] of pts) area.lineTo(x, y);
        area.lineTo(pts[pts.length - 1][0], bottom).closePath().fill({ color: COLORS.brand, alpha: 0.08 });
        for (const [w, alpha] of [
          [7, 0.14],
          [2.5, 1],
        ] as const) {
          lines.moveTo(pts[0][0], pts[0][1]);
          for (const [x, y] of pts.slice(1)) lines.lineTo(x, y);
          lines.stroke({ color: COLORS.brand, width: w, alpha, join: 'round', cap: 'round' });
        }
        const [hx, hy] = pts[pts.length - 1];
        // Not yet recorded: the future is dimmed.
        marks.rect(hx, padT, W - hx, bottom - padT).fill({ color: COLORS.bg, alpha: 0.35 });
        marks.moveTo(hx, padT).lineTo(hx, bottom).stroke({ color: COLORS.brand, width: 1, alpha: 0.5 });
        marks.circle(hx, hy, 8 + Math.sin(clock * 8) * 2).fill({ color: COLORS.brand, alpha: 0.25 });
        marks.circle(hx, hy, 4).fill({ color: 0xffffff });
        nowT.position.set(hx - 6, padT + 2);
        nowT.visible = hx > 70;
        const day = Math.min(6, Math.floor(last / 24));
        nowT.text = `${DAY_NAMES[day]} ${String(last % 24).padStart(2, '0')}:00`;
      }
    };

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (pausedRef.current || game.finished || game.pending) return;
      audio.unlock();
      const hour = game.viewStart + e.global.x / pxPerHour;
      if (hour > game.cursor + 0.5) return;
      const before = game.mistakes;
      setDiagTop(e.global.y > H * 0.5);
      game.tap(hour);
      if (game.mistakes > before) fx.current?.wrong(e.global.x, e.global.y);
      if (tip) {
        setTip(null);
        props.onTipDone?.();
      }
      setFrame((f) => f + 1);
    });

    layout();
    app.renderer.on('resize', layout);
    let hudAcc = 0;
    app.ticker.add((tk) => {
      const dt = Math.min(0.05, tk.deltaMS / 1000);
      clock += dt;
      if (!pausedRef.current && !game.finished) {
        game.update(dt);
        hudAcc += dt;
        if (hudAcc > 0.1) {
          hudAcc = 0;
          setFrame((f) => f + 1);
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

  const pending = game.pending;
  const pick = (k: AnomalyKind) => {
    audio.play('tap');
    game.diagnose(k);
    setFrame((f) => f + 1);
  };

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.timeLeft} onPause={props.onPause}>
        <span class="pill" aria-label="Najdene anomalije">
          🔎 {game.foundCount}/{total}
        </span>
      </Hud>
      <div class={`stage${pending ? ' slowmo' : ''}`} ref={stageRef}>
        <div class="pixi-host" ref={host} />
        {game.combo >= 2 && !pending && (
          <div class="toast-line good" style={{ top: 'auto', bottom: '44px' }}>
            Combo ×{game.combo}
            {game.combo >= 3 ? ' · dvojni DP' : ''}
          </div>
        )}
        {toast && !pending && (
          <div class={`toast-line ${toast.kind}`} key={toast.id} role="status">
            {toast.text}
          </div>
        )}
        {pending && (
          <div class={`diag${diagTop ? ' top' : ''}`} role="dialog" aria-label="Kaj je vzrok?">
            <div class="diag-head">
              <b>Kaj je vzrok?</b>
              <span class="diag-time" style={{ '--p': pending.left / game.diagnoseSec }} />
            </div>
            <div class="diag-opts">
              {pending.options.map((k) => (
                <button class="diag-opt" data-kind={k} onClick={() => pick(k)}>
                  <svg viewBox="0 0 60 24" aria-hidden="true">
                    <path d={GLYPH[k]} />
                  </svg>
                  <b>{ANOMALY_INFO[k].name}</b>
                  <small>{ANOMALY_INFO[k].clue}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {tip && (
          <div class="hint">
            <GenkoSays text={tip} size={44} />
          </div>
        )}
      </div>
      <div class="meter-legend" style={{ justifyContent: 'center' }}>
        <span class="tiny muted">Tapni odstopanje od svetlega pasu, nato izberi vzrok. Kar je na urniku, je načrtovano.</span>
      </div>
    </>
  );
}
