import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { WmbusParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { WmbusGame, type Cell, type DeviceKind } from './logic';
import { expose } from '../../testHooks';
import { plural } from '../../core/balance';

const WATER = 0x4fa8ff;
const HEAT = 0xff8a4f;

export function WmbusView(props: GameProps<WmbusParams>) {
  const bonus = 6 * (props.research.vzorcenje ?? 0);
  const ai = (props.research.ai ?? 0) > 0;
  const game = useMemo(() => new WmbusGame(props.params, bonus), []);
  const [time, setTime] = useState(game.timeLeft);
  const [, setVersion] = useState(0);
  const [kind, setKind] = useState<DeviceKind>(game.puzzle.budget.gateway > 0 ? 'gateway' : 'repeater');
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ burst(c: Cell, color: number): void; float(c: Cell, text: string, color: number): void; ping(c: Cell): void } | null>(null);
  const total = game.puzzle.meters.length;
  const optimal = game.puzzle.solution.length;

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      game.on((e) => {
        switch (e.type) {
          case 'placed': {
            audio.play('connect');
            buzz(15);
            fx.current?.ping(e.device);
            if (!game.isLinked(e.device)) showToast('Repetitor nima signala do prehoda', 'bad');
            e.newlyCovered.forEach((id, i) => {
              const m = game.puzzle.meters[id];
              setTimeout(() => {
                audio.play('online');
                fx.current?.burst(m, COLORS.green);
                fx.current?.float(m, 'SIGNAL', COLORS.green);
              }, 120 + i * 110);
            });
            // Kick remaining switch to the other device type when this one runs out.
            if (game.remaining(e.device.kind) === 0) {
              const other: DeviceKind = e.device.kind === 'gateway' ? 'repeater' : 'gateway';
              if (game.remaining(other) > 0) setKind(other);
            }
            break;
          }
          case 'removed':
            audio.play('off');
            if (game.remaining(e.device.kind) > 0) setKind(e.device.kind);
            break;
          case 'blocked':
            audio.play('blocked');
            buzz([20, 20, 20]);
            if (e.reason === 'budget') {
              shake();
              showToast('Ni več naprav. Tapni postavljeno, da jo pobereš.', 'bad');
            } else showToast(e.reason === 'building' ? 'Na stavbo ne gre.' : 'Tu je vodomer.', 'bad');
            break;
          case 'won':
          case 'timeout':
            finish();
            break;
        }
        setVersion((v) => v + 1);
      }),
    [],
  );

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const won = game.finished === 'won';
    audio.play(won ? 'win' : 'fail');
    const covered = game.coveredCount;
    const used = game.devices.length;
    setTimeout(
      () =>
        props.onDone({
          kind: 'wmbus',
          completed: won,
          mistakes: game.mistakes,
          timeLeft: Math.floor(game.timeLeft),
          timeTotal: game.timeTotal,
          score: game.score(),
          metrics: { covered, total, used, optimal },
          failHint: won ? undefined : `še ${total - covered} ${plural(total - covered, 'vodomer', 'vodomera', 'vodomeri', 'vodomerov')} brez signala`,
          emoji: `📡${'🟦'.repeat(covered)}${'⬛'.repeat(total - covered)} ${used <= optimal ? '✨' : '🔁'.repeat(Math.min(3, used - optimal))}`,
        }),
      won ? 1000 : 700,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const board = new Graphics();
    const ranges = new Graphics();
    const links = new Graphics();
    const pieces = new Graphics();
    const waves = new Graphics();
    const labels = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    // Range bubbles and waves stay inside the town.
    const clip = new Graphics();
    ranges.mask = clip;
    waves.mask = clip;
    root.addChild(board, clip, ranges, links, waves, pieces, labels, particles.layer, floaters.layer);

    const { cols, rows, range } = game.puzzle;
    let cell = 40;
    let ox = 0;
    let oy = 0;
    const center = (c: Cell) => ({ x: ox + c.x * cell + cell / 2, y: oy + c.y * cell + cell / 2 });
    const cellAt = (x: number, y: number): Cell => ({ x: Math.floor((x - ox) / cell), y: Math.floor((y - oy) / cell) });
    expose('wmbus', { game, center, canvas: app.canvas });
    const pings: { x: number; y: number; t: number }[] = [];

    fx.current = {
      burst: (c, color) => {
        const p = center(c);
        particles.burst(p.x, p.y, color, 20, 180, { gravity: 0, size: 2.5, life: 0.6 });
      },
      float: (c, text, color) => {
        const p = center(c);
        floaters.add(text, p.x, p.y - cell * 0.6, color, 12);
      },
      ping: (c) => {
        const p = center(c);
        pings.push({ x: p.x, y: p.y, t: 0 });
      },
    };

    const layout = () => {
      const w = app.screen.width;
      const h = app.screen.height;
      cell = Math.floor(Math.min((w - 20) / cols, (h - 20) / rows));
      ox = Math.floor((w - cell * cols) / 2);
      oy = 10;
      clip.clear().roundRect(ox - 4, oy - 4, cols * cell + 8, rows * cell + 8, 14).fill({ color: 0xffffff });
      drawBoard();
    };

    const drawBoard = () => {
      board.clear();
      for (const t of labels.removeChildren()) t.destroy();
      // Streets between the blocks: the town seen from above.
      board.roundRect(ox - 4, oy - 4, cols * cell + 8, rows * cell + 8, 14).fill({ color: 0x0b1330 }).stroke({ color: COLORS.line, width: 1 });
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const px = ox + x * cell;
          const py = oy + y * cell;
          if (game.isBlocked(x, y)) {
            const inset = cell * 0.12;
            board.roundRect(px + inset, py + inset + 3, cell - inset * 2, cell - inset * 2, 5).fill({ color: 0x0a0f24 });
            board.roundRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2, 5).fill({ color: 0x27325f }).stroke({ color: 0x3a4785, width: 1 });
            // Windows
            for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) board.rect(px + cell * (0.3 + i * 0.26), py + cell * (0.3 + j * 0.26), cell * 0.12, cell * 0.1).fill({ color: (x * 7 + y * 3 + i + j) % 3 ? 0x3b4a8a : 0xffd36e, alpha: 0.8 });
          } else board.roundRect(px + 2, py + 2, cell - 4, cell - 4, 6).fill({ color: 0x0f1940 });
        }
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const t = label(m.type === 'voda' ? 'V' : 'T', { fontFamily: MONO, fontSize: Math.max(10, cell * 0.26), fontWeight: '800', fill: 0xffffff });
        t.anchor.set(0.5);
        t.position.set(c.x, c.y);
        labels.addChild(t);
      }
    };

    let clock = 0;
    let ghost: Cell | null = null;
    let pressed: Cell | null = null;

    const draw = () => {
      ranges.clear();
      links.clear();
      pieces.clear();
      waves.clear();
      const R = range * cell;
      // Range bubbles first, so pieces stay readable on top.
      for (const d of game.devices) {
        const c = center(d);
        const linked = game.isLinked(d);
        ranges.circle(c.x, c.y, R).fill({ color: linked ? COLORS.brand : COLORS.orange, alpha: linked ? 0.07 : 0.05 }).stroke({ color: linked ? COLORS.brand : COLORS.orange, width: 1.5, alpha: linked ? 0.45 : 0.6 });
      }
      if (ghost) {
        const c = center(ghost);
        const ok = !game.isBlocked(ghost.x, ghost.y) && !game.meterAt(ghost.x, ghost.y) && !game.deviceAt(ghost.x, ghost.y);
        ranges.circle(c.x, c.y, R).fill({ color: ok ? 0xffffff : COLORS.red, alpha: 0.06 }).stroke({ color: ok ? 0xffffff : COLORS.red, width: 2, alpha: 0.7 });
      }
      // Radio links between devices: animated dashes travelling to the gateway.
      for (const [a, b] of game.links) {
        const pa = center(a);
        const pb = center(b);
        const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        const n = Math.floor(len / 10);
        for (let i = 0; i < n; i++) {
          const u = ((i + (clock * 3) % 2) / n) % 1;
          const x = pb.x + (pa.x - pb.x) * u;
          const y = pb.y + (pa.y - pb.y) * u;
          if (i % 2 === 0) links.circle(x, y, 2).fill({ color: COLORS.brand, alpha: 0.9 });
        }
      }
      // Meter → device packets
      for (const m of game.puzzle.meters) {
        const d = game.coveredBy(m.id);
        if (!d) continue;
        const pm = center(m);
        const pd = center(d);
        links.moveTo(pm.x, pm.y).lineTo(pd.x, pd.y).stroke({ color: COLORS.green, width: 1, alpha: 0.25 });
        const u = (clock * 0.8 + m.id * 0.37) % 1;
        links.circle(pm.x + (pd.x - pm.x) * u, pm.y + (pd.y - pm.y) * u, cell * 0.06).fill({ color: COLORS.green });
      }
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const covered = !!game.coveredBy(m.id);
        const color = m.type === 'voda' ? WATER : HEAT;
        const s = cell * 0.62;
        if (covered) pieces.circle(c.x, c.y, s * 0.7 + Math.sin(clock * 4 + m.id) * 1.5).fill({ color: COLORS.green, alpha: 0.2 });
        else pieces.circle(c.x, c.y, s * 0.72).stroke({ color, width: 2, alpha: 0.3 + 0.3 * Math.sin(clock * 5 + m.id) });
        pieces.circle(c.x, c.y, s / 2).fill({ color: covered ? 0x0d2a24 : 0x111a3d }).stroke({ color: covered ? COLORS.green : color, width: 3 });
        if (ai && !covered) {
          // AI hint: the uncovered meter blinks orange in the corner.
          pieces.circle(c.x + s / 2, c.y - s / 2, cell * 0.1).fill({ color: COLORS.orange, alpha: 0.6 + 0.4 * Math.sin(clock * 8) });
        }
      }
      for (const d of game.devices) {
        const c = center(d);
        const linked = game.isLinked(d);
        const color = linked ? COLORS.brand : COLORS.orange;
        if (d.kind === 'gateway') {
          const s = cell * 0.7;
          pieces.roundRect(c.x - s / 2, c.y - s / 2, s, s, 8).fill({ color: 0x0b2440 }).stroke({ color, width: 3 });
          pieces.moveTo(c.x, c.y + s * 0.25).lineTo(c.x, c.y - s * 0.3).stroke({ color: 0xffffff, width: 3, cap: 'round' });
          pieces.circle(c.x, c.y - s * 0.3, 3.5).fill({ color: COLORS.green });
        } else {
          const s = cell * 0.32;
          pieces.poly([c.x, c.y - s, c.x + s * 0.9, c.y + s * 0.8, c.x - s * 0.9, c.y + s * 0.8]).fill({ color: 0x0b2440 }).stroke({ color, width: 3, join: 'round' });
          pieces.circle(c.x, c.y - s, 3).fill({ color: linked ? COLORS.green : COLORS.red, alpha: linked ? 1 : 0.5 + 0.5 * Math.sin(clock * 10) });
        }
        // Radio waves pulse from linked devices.
        if (linked && !props.reducedMotion) {
          for (let k = 0; k < 2; k++) {
            const u = (clock * 0.7 + k * 0.5 + d.id * 0.13) % 1;
            waves.circle(c.x, c.y, R * u).stroke({ color: COLORS.brand, width: 2, alpha: 0.35 * (1 - u) });
          }
        }
      }
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        p.t += 1 / 60;
        if (p.t > 0.5) {
          pings.splice(i, 1);
          continue;
        }
        waves.circle(p.x, p.y, R * (p.t / 0.5)).stroke({ color: 0xffffff, width: 3, alpha: 1 - p.t / 0.5 });
      }
    };

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    const inBoard = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows;
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (pausedRef.current || game.finished) return;
      audio.unlock();
      const c = cellAt(e.global.x, e.global.y);
      if (!inBoard(c)) return;
      pressed = c;
      if (!game.deviceAt(c.x, c.y)) ghost = c;
    });
    app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!pressed || !ghost) return;
      const c = cellAt(e.global.x, e.global.y);
      if (inBoard(c) && (c.x !== ghost.x || c.y !== ghost.y)) {
        ghost = c;
        audio.play('step');
      }
    });
    const release = () => {
      if (!pressed) return;
      const target = ghost ?? pressed;
      ghost = null;
      pressed = null;
      if (pausedRef.current || game.finished) return;
      game.tap(target.x, target.y, kindRef.current);
      if (tip) {
        setTip(null);
        props.onTipDone?.();
      }
    };
    app.stage.on('pointerup', release);
    app.stage.on('pointerupoutside', release);

    layout();
    app.renderer.on('resize', layout);
    let hudAcc = 0;
    app.ticker.add((tk) => {
      const dt = Math.min(0.05, tk.deltaMS / 1000);
      clock += dt;
      if (!pausedRef.current) {
        game.update(dt);
        hudAcc += dt;
        if (hudAcc > 0.2) {
          hudAcc = 0;
          setTime(game.timeLeft);
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

  const pick = (k: DeviceKind) => {
    audio.play('tap');
    setKind(k);
  };
  const gw = game.remaining('gateway');
  const rp = game.remaining('repeater');

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={time} onPause={props.onPause}>
        <span class="pill" aria-label="Pokriti vodomeri">
          📡 {game.coveredCount}/{total}
        </span>
      </Hud>
      <div class="stage" ref={stageRef}>
        <div class="pixi-host" ref={host} />
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
      <div class="device-bar" role="radiogroup" aria-label="Izberi napravo">
        {game.puzzle.budget.gateway > 0 && (
          <button class={`device-pick${kind === 'gateway' ? ' sel' : ''}`} role="radio" aria-checked={kind === 'gateway'} disabled={gw <= 0 && kind !== 'gateway'} onClick={() => pick('gateway')} aria-label={`Prehod, še ${gw}`}>
            <span class="device-ico gw" />
            <span>
              <b>Prehod</b>
              <small>v oblak</small>
            </span>
            <span class="device-count mono">×{gw}</span>
          </button>
        )}
        {game.puzzle.budget.repeater > 0 && (
          <button class={`device-pick${kind === 'repeater' ? ' sel' : ''}`} role="radio" aria-checked={kind === 'repeater'} disabled={rp <= 0 && kind !== 'repeater'} onClick={() => pick('repeater')} aria-label={`Repetitor, še ${rp}`}>
            <span class="device-ico rp" />
            <span>
              <b>Repetitor</b>
              <small>podaljša doseg</small>
            </span>
            <span class="device-count mono">×{rp}</span>
          </button>
        )}
      </div>
      <div class="meter-legend" style={{ justifyContent: 'center' }}>
        <span class="tiny muted">Postavi napravo, da vsi vodomeri (V) in toplotni števci (T) slišijo signal. Repetitor mora slišati prehod. Optimalno: {optimal} {plural(optimal, 'naprava', 'napravi', 'naprave', 'naprav')}.</span>
      </div>
    </>
  );
}
