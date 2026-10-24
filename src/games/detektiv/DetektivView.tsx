import { Container, Graphics, type FederatedPointerEvent, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { DetektivParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { DAY_NAMES } from '../../data/profiles';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, sparkline, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { ANOMALY_INFO, DetektivGame, POINTS, VIEW_HOURS } from './logic';
import { expose } from '../../testHooks';
import { plural } from '../../core/balance';

export function DetektivView(props: GameProps<DetektivParams>) {
  const ai = (props.research.ai ?? 0) > 0;
  const game = useMemo(() => new DetektivGame(props.params), []);
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ found(hour: number, text: string): void; wrong(x: number, y: number): void } | null>(null);
  const total = game.data.anomalies.length;
  expose('detektiv', game);

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      game.on((e) => {
        switch (e.type) {
          case 'found':
            audio.play('found');
            if (e.combo >= 3) setTimeout(() => audio.play('coin'), 120);
            buzz(20);
            fx.current?.found(e.anomaly.start + e.anomaly.len / 2, e.combo >= 3 ? `COMBO ×${e.combo}  +${e.points / 10} DP` : `+${e.points / 10} DP`);
            showToast(`${ANOMALY_INFO[e.anomaly.kind].name}!`, 'good');
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
      }),
    [],
  );

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const found = game.foundCount;
    const completed = found >= Math.ceil(total * 0.6);
    audio.play(completed ? 'win' : 'fail');
    const notes = game.data.anomalies.map((a) => `${a.found ? '✓' : '✗'} ${ANOMALY_INFO[a.kind].name} (${DAY_NAMES[Math.floor(a.start / 24)]} ${String(a.start % 24).padStart(2, '0')}:00) – ${ANOMALY_INFO[a.kind].why}`);
    // Combo bonus: the second 100 of every doubled find becomes extra DP.
    const bonusDp = Math.round((game.points - found * 100) / 10);
    setTimeout(
      () =>
        props.onDone({
          kind: 'detektiv',
          completed,
          mistakes: game.mistakes,
          timeLeft: 0,
          timeTotal: props.params.durationSec,
          score: game.points,
          metrics: { found, missed: total - found, total, bonusDp, bestCombo: game.bestCombo },
          failHint: completed ? undefined : `še ${Math.ceil(total * 0.6) - found} ${plural(Math.ceil(total * 0.6) - found, 'anomalija', 'anomaliji', 'anomalije', 'anomalij')}`,
          emoji: `🔎${game.data.anomalies.map((a) => (a.found ? '🟩' : '🟥')).join('')}${game.mistakes ? '❌'.repeat(Math.min(3, game.mistakes)) : '✨'} ${sparkline(game.data.actual, 7)}`,
          notes,
        }),
      800,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const bands = new Graphics();
    const lines = new Graphics();
    const marks = new Graphics();
    const texts = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(bands, lines, marks, texts, particles.layer, floaters.layer);

    const d = game.data;
    const yMax = Math.max(...d.actual, ...d.normal) * 1.12;
    let W = 0;
    let H = 0;
    const padT = 40;
    const padB = 30;
    let pxPerHour = 1;
    const X = (h: number) => (h - game.viewStart) * pxPerHour;
    const Y = (kw: number) => padT + (1 - kw / yMax) * (H - padT - padB);
    const dayTexts: Text[] = [];
    const legend = label('svetla črta = tipičen teden', { fontSize: 11, fill: COLORS.muted });
    legend.position.set(12, 10);
    const nowT = label('', { fontFamily: MONO, fontSize: 12, fontWeight: '700', fill: COLORS.brand });
    nowT.anchor.set(1, 0);
    texts.addChild(legend, nowT);
    for (let day = 0; day < 7; day++) {
      const t = label(DAY_NAMES[day], { fontSize: 11, fontWeight: '700', fill: day >= 5 ? COLORS.orange : COLORS.muted });
      t.anchor.set(0.5, 0);
      dayTexts.push(t);
      texts.addChild(t);
    }

    const layout = () => {
      W = app.screen.width;
      H = app.screen.height;
      pxPerHour = W / VIEW_HOURS;
      nowT.position.set(W - 10, 10);
    };

    fx.current = {
      found: (hour, text) => {
        const x = X(hour);
        const y = Y(d.actual[Math.floor(hour)] ?? 0);
        particles.burst(x, y, COLORS.green, 26, 220, { gravity: 0, life: 0.8 });
        floaters.add(text, x, y - 26, COLORS.green, 15);
      },
      wrong: (x, y) => particles.burst(x, y, COLORS.red, 14, 160, { gravity: 300 }),
    };

    let clock = 0;
    const draw = () => {
      bands.clear();
      lines.clear();
      marks.clear();
      const start = game.viewStart;
      const end = Math.min(POINTS, start + VIEW_HOURS);
      // Night and weekend shading: where consumption should be low.
      for (let h = Math.floor(start); h < end + 1; h++) {
        const hour = h % 24;
        const day = Math.floor(h / 24);
        const night = hour >= 22 || hour < 6;
        if (day >= 5) bands.rect(X(h), padT, pxPerHour + 0.5, H - padT - padB).fill({ color: COLORS.orange, alpha: 0.045 });
        if (night) bands.rect(X(h), padT, pxPerHour + 0.5, H - padT - padB).fill({ color: 0x4f7dff, alpha: 0.07 });
        if (hour === 0) bands.moveTo(X(h), padT).lineTo(X(h), H - padB).stroke({ color: COLORS.line, width: 1 });
      }
      dayTexts.forEach((t, day) => {
        const x = X(day * 24 + 12);
        t.visible = x > -20 && x < W + 20;
        t.position.set(x, H - padB + 8);
      });
      for (const a of d.anomalies) {
        if (a.start > game.cursor) continue;
        const x0 = X(a.start - 0.5);
        const x1 = X(a.start + a.len - 0.5);
        if (a.found) bands.roundRect(x0, padT, x1 - x0, H - padT - padB, 6).fill({ color: COLORS.green, alpha: 0.14 }).stroke({ color: COLORS.green, width: 1.5, alpha: 0.7 });
        else if (a.missed) bands.roundRect(x0, padT, x1 - x0, H - padT - padB, 6).stroke({ color: COLORS.red, width: 1.5, alpha: 0.6 });
        else if (ai && game.cursor > a.start + a.len + 1.5) bands.roundRect(x0, padT, x1 - x0, H - padT - padB, 6).fill({ color: COLORS.brand, alpha: 0.05 + 0.05 * Math.sin(clock * 5) });
      }
      // Typical week ghost line: comparison of periods.
      lines.moveTo(X(start), Y(d.normal[Math.floor(start)]));
      for (let h = Math.floor(start); h < end; h++) lines.lineTo(X(h), Y(d.normal[h]));
      lines.stroke({ color: 0xc9d6ff, width: 2.5, alpha: 0.45 });
      const cur = game.cursor;
      if (cur > start) {
        const last = Math.min(Math.floor(cur), POINTS - 1);
        lines.moveTo(X(Math.floor(start)), Y(d.actual[Math.floor(start)]));
        for (let h = Math.floor(start) + 1; h <= last; h++) lines.lineTo(X(h), Y(d.actual[h]));
        lines.stroke({ color: COLORS.brand, width: 6, alpha: 0.15, join: 'round' });
        lines.moveTo(X(Math.floor(start)), Y(d.actual[Math.floor(start)]));
        for (let h = Math.floor(start) + 1; h <= last; h++) lines.lineTo(X(h), Y(d.actual[h]));
        lines.stroke({ color: COLORS.brand, width: 2.5, join: 'round' });
        const hx = X(last);
        const hy = Y(d.actual[last]);
        marks.moveTo(hx, padT).lineTo(hx, H - padB).stroke({ color: COLORS.brand, width: 1, alpha: 0.5 });
        marks.circle(hx, hy, 8 + Math.sin(clock * 8) * 2).fill({ color: COLORS.brand, alpha: 0.25 });
        marks.circle(hx, hy, 4).fill({ color: 0xffffff });
        const day = Math.min(6, Math.floor(last / 24));
        nowT.text = `${DAY_NAMES[day]} ${String(last % 24).padStart(2, '0')}:00`;
      }
    };

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (pausedRef.current || game.finished) return;
      audio.unlock();
      const hour = game.viewStart + e.global.x / pxPerHour;
      if (hour > game.cursor + 0.5) return;
      const before = game.mistakes;
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
        if (hudAcc > 0.2) {
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

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.timeLeft} onPause={props.onPause}>
        <span class="pill" aria-label="Najdene anomalije">
          🔎 {game.foundCount}/{total}
        </span>
      </Hud>
      <div class="stage" ref={stageRef}>
        <div class="pixi-host" ref={host} />
        {game.combo >= 2 && (
          <div class="toast-line good" style={{ top: 'auto', bottom: '44px' }}>
            Combo ×{game.combo}
            {game.combo >= 3 ? ' · dvojni DP' : ''}
          </div>
        )}
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
      <div class="meter-legend" style={{ justifyContent: 'center' }}>
        <span class="tiny muted">Tapni na graf, kjer poraba odstopa od tipičnega tedna. Modro = noč, oranžno = vikend.</span>
      </div>
    </>
  );
}
