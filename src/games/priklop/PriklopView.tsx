import { Container, Graphics, type FederatedPointerEvent, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PriklopParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Sheet } from '../../ui/components/Common';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { ADDRESS_MAX, PriklopGame, type Cell } from './logic';
import { expose } from '../../testHooks';
import { plural } from '../../core/balance';

export const METER_COLORS = [0x38e1ff, 0xffb340, 0xff4fd8, 0x3dff9a, 0xb18cff, 0xffe14d, 0xff7a59];
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function PriklopView(props: GameProps<PriklopParams>) {
  const bonus = 6 * (props.research.vzorcenje ?? 0);
  const ai = (props.research.ai ?? 0) > 0;
  const game = useMemo(() => new PriklopGame(props.params, bonus), []);
  const [time, setTime] = useState(game.timeLeft);
  const [, setVersion] = useState(0);
  const [config, setConfig] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const [flash, setFlash] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const fx = useRef<{ spark(cell: Cell, color?: number): void; burst(cell: Cell, color: number): void; float(cell: Cell, text: string, color: number): void } | null>(null);

  const showToast = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let lastStep = 0;
    return game.on((e) => {
      const m = 'meter' in e ? game.puzzle.meters[e.meter] : null;
      switch (e.type) {
        case 'step': {
          const now = performance.now();
          if (now - lastStep > 40) audio.play('step');
          lastStep = now;
          break;
        }
        case 'blocked':
          audio.play('blocked');
          break;
        case 'online':
          audio.play('connect');
          setTimeout(() => audio.play('online'), 90);
          buzz(25);
          if (m) {
            fx.current?.burst(m, COLORS.green);
            fx.current?.float(m, 'ONLINE', COLORS.green);
          }
          setVersion((v) => v + 1);
          break;
        case 'spark':
          audio.play('spark');
          buzz([40, 30, 60]);
          if (m) fx.current?.spark(m);
          shake();
          setFlash((f) => f + 1);
          showToast(`Iskra! M${e.meter + 1}: naslov ${m!.address} je že zaseden`, 'bad');
          setVersion((v) => v + 1);
          break;
        case 'cut':
          audio.play('off');
          buzz(10);
          setVersion((v) => v + 1);
          break;
        case 'unfilled':
          audio.play('blocked');
          showToast(`Vsi priklopljeni, a ${e.empty} ${plural(e.empty, 'polje je', 'polji sta', 'polja so', 'polj je')} še ${e.empty === 1 ? 'prazno' : e.empty === 2 ? 'prazni' : 'prazna'}. Kabli morajo zapolniti vse!`, 'bad');
          break;
        case 'dropout':
          audio.play('alarm');
          buzz([60, 40, 60]);
          fx.current?.spark(e.cell, COLORS.orange);
          showToast(`Izpad! Kabel M${e.meter + 1} je pretrgan, potegni ga do konca`, 'bad');
          setVersion((v) => v + 1);
          break;
        case 'won':
        case 'timeout':
          finish();
          break;
      }
    });
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const won = game.finished === 'won';
    audio.play(won ? 'win' : 'fail');
    const online = game.onlineCount;
    const total = game.puzzle.meters.length;
    setTimeout(
      () =>
        props.onDone({
          kind: 'priklop',
          completed: won,
          mistakes: game.mistakes,
          timeLeft: Math.floor(game.timeLeft),
          timeTotal: game.timeTotal,
          score: game.score(),
          metrics: { online, total },
          failHint: won ? undefined : `še ${total - online} ${plural(total - online, 'merilnik', 'merilnika', 'merilniki', 'merilnikov')}`,
          emoji: `🔌${'🟩'.repeat(online)}${'⬛'.repeat(total - online)}${game.mistakes ? '⚡'.repeat(Math.min(game.mistakes, 3)) : '✨'}`,
        }),
      won ? 900 : 700,
    );
  };

  const host = usePixi((app) => {
    const root = new Container();
    app.stage.addChild(root);
    const board = new Graphics();
    const tint = new Graphics();
    const cables = new Graphics();
    const dots = new Graphics();
    const pieces = new Graphics();
    const labels = new Container();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(board, tint, cables, dots, pieces, labels, particles.layer, floaters.layer);

    const { cols, rows } = game.puzzle;
    let cell = 40;
    let ox = 0;
    let oy = 0;
    const center = (c: Cell) => ({ x: ox + c.x * cell + cell / 2, y: oy + c.y * cell + cell / 2 });
    const cellAt = (x: number, y: number): Cell => ({ x: Math.floor((x - ox) / cell), y: Math.floor((y - oy) / cell) });
    expose('priklop', { game, center, canvas: app.canvas });

    fx.current = {
      spark: (c, color = COLORS.red) => {
        const p = center(c);
        particles.burst(p.x, p.y, color, 34, 340, { gravity: 500, size: 2.5 });
        particles.burst(p.x, p.y, 0xffffff, 8, 160, { size: 1.5, life: 0.3 });
      },
      burst: (c, color) => {
        const p = center(c);
        particles.burst(p.x, p.y, color, 22, 200, { gravity: 0, size: 2.5, life: 0.7 });
      },
      float: (c, text, color) => {
        const p = center(c);
        floaters.add(text, p.x, p.y - cell * 0.6, color, 13);
      },
    };

    const layout = () => {
      const w = app.screen.width;
      const h = app.screen.height;
      cell = Math.floor(Math.min((w - 28) / cols, (h - 24) / rows));
      ox = Math.floor((w - cell * cols) / 2);
      oy = Math.max(12, Math.floor((h - cell * rows) / 2));
      drawBoard();
    };

    const drawBoard = () => {
      board.clear();
      for (const t of labels.removeChildren()) t.destroy();
      const W = cols * cell;
      const H = rows * cell;
      // Cable tray: a dark panel with rivets, like the inside of an electrical cabinet.
      board.roundRect(ox - 10, oy - 10, W + 20, H + 20, 18).fill({ color: 0x050914 }).stroke({ color: 0x2a3a74, width: 2 });
      board.roundRect(ox - 4, oy - 4, W + 8, H + 8, 14).fill({ color: 0x0a1028 });
      for (const [rx, ry] of [[ox - 3, oy - 3], [ox + W + 3, oy - 3], [ox - 3, oy + H + 3], [ox + W + 3, oy + H + 3]]) board.circle(rx, ry, 3).fill({ color: 0x3a4a86 });
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) board.roundRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, cell * 0.18).fill({ color: 0x101a40 });
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const t = label(`M${m.id + 1}`, { fontFamily: MONO, fontSize: Math.max(10, cell * 0.24), fontWeight: '800', fill: 0xffffff });
        t.anchor.set(0.5);
        t.position.set(c.x, c.y - cell * 0.05);
        const id = label(`ID ${m.address}`, { fontFamily: MONO, fontSize: Math.max(7, cell * 0.13), fill: 0xc9d6ff });
        id.anchor.set(0.5, 0);
        id.position.set(c.x, c.y + cell * 0.1);
        (id as Text & { meterId?: number }).meterId = m.id;
        labels.addChild(t, id);
      }
    };

    const refreshMeterLabels = () => {
      for (const child of labels.children) {
        const t = child as Text & { meterId?: number };
        if (t.meterId !== undefined) {
          const text = `ID ${game.puzzle.meters[t.meterId].address}`;
          if (t.text !== text) t.text = text;
        }
      }
    };

    let clock = 0;
    let hover: Cell | null = null;
    let winAt = -1;
    game.on((e) => {
      if (e.type === 'won') winAt = clock;
    });

    const draw = () => {
      tint.clear();
      cables.clear();
      dots.clear();
      pieces.clear();
      const active = game.active;
      // Filled cells take the colour of their cable: the board visibly "fills up".
      for (const [id, path] of game.paths) {
        const color = METER_COLORS[id % METER_COLORS.length];
        const online = game.status.get(id) === 'online';
        for (const c of path) tint.roundRect(ox + c.x * cell + 2, oy + c.y * cell + 2, cell - 4, cell - 4, cell * 0.18).fill({ color, alpha: online ? 0.2 : 0.1 });
      }
      if (active !== null && hover) tint.roundRect(ox + hover.x * cell + 1, oy + hover.y * cell + 1, cell - 2, cell - 2, cell * 0.2).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
      // Victory sweep: a light wave rolls diagonally over the full board.
      if (winAt >= 0) {
        const t = (clock - winAt) * 9;
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < cols; x++) {
            const d = t - (x + y);
            if (d > 0 && d < 3) tint.roundRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, cell * 0.18).fill({ color: 0xffffff, alpha: 0.35 * (1 - d / 3) });
          }
      }
      for (const [id, path] of game.paths) {
        if (path.length < 2) continue;
        const color = METER_COLORS[id % METER_COLORS.length];
        const status = game.status.get(id);
        const pts = path.map(center);
        const stroke = (width: number, c: number, alpha: number) => {
          cables.moveTo(pts[0].x, pts[0].y);
          for (const p of pts.slice(1)) cables.lineTo(p.x, p.y);
          cables.stroke({ width, color: c, alpha, cap: 'round', join: 'round' });
        };
        const flicker = 1;
        const c = color;
        if (status === 'online') stroke(cell * 0.62, c, 0.12 + 0.05 * Math.sin(clock * 3 + id));
        if (status === 'error') stroke(cell * 0.62, COLORS.red, 0.35 * (0.5 + 0.5 * Math.sin(clock * 14)));
        stroke(cell * 0.4, 0x02040c, 0.6);
        stroke(cell * 0.32, c, 0.95 * flicker);
        // Highlight stripe gives the cable a round, rubbery look.
        cables.moveTo(pts[0].x - cell * 0.05, pts[0].y - cell * 0.05);
        for (const p of pts.slice(1)) cables.lineTo(p.x - cell * 0.05, p.y - cell * 0.05);
        cables.stroke({ width: cell * 0.07, color: 0xffffff, alpha: 0.35 * flicker, cap: 'round', join: 'round' });
        if (status === 'online') {
          const len = pts.length - 1;
          const n = Math.max(2, Math.floor(len / 2));
          for (let k = 0; k < n; k++) {
            const u = (((clock * 2.4 + (k * len) / n) % len) + len) % len;
            const i = Math.floor(u);
            const f = u - i;
            const x = pts[i].x + (pts[i + 1].x - pts[i].x) * f;
            const y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
            dots.circle(x, y, cell * 0.07).fill({ color: 0xffffff, alpha: 0.95 });
          }
        }
      }
      const partner = (id: number) => {
        const path = game.paths.get(id);
        if (!path) return null;
        const m = game.puzzle.meters[id];
        return path[0].x === m.x && path[0].y === m.y ? game.puzzle.ports[id] : m;
      };
      const target = active !== null ? partner(active) : null;
      for (const port of game.puzzle.ports) {
        const c = center(port);
        const color = METER_COLORS[port.id % METER_COLORS.length];
        const online = game.status.get(port.id) === 'online';
        const glow = target === port ? 1 : 0;
        const r = cell * 0.34 * (1 + glow * 0.12 * Math.sin(clock * 10));
        if (glow) pieces.circle(c.x, c.y, r * 1.5).fill({ color, alpha: 0.25 });
        pieces.circle(c.x, c.y, r).fill({ color: 0x050914 }).stroke({ color, width: cell * 0.09 });
        // Terminal LED on top of the socket: green once its meter talks.
        pieces.circle(c.x, c.y - r * 0.5, r * 0.16).fill({ color: online ? COLORS.green : 0x2a3566 });
      }
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const color = METER_COLORS[m.id % METER_COLORS.length];
        const status = game.status.get(m.id);
        const glow = target === m;
        const s = cell * 0.78 * (glow ? 1 + 0.06 * Math.sin(clock * 10) : 1);
        if (status === 'online') pieces.roundRect(c.x - s / 2 - 4, c.y - s / 2 - 4, s + 8, s + 8, 12).fill({ color: COLORS.green, alpha: 0.18 + 0.08 * Math.sin(clock * 4) });
        if (status === 'error') pieces.roundRect(c.x - s / 2 - 4, c.y - s / 2 - 4, s + 8, s + 8, 12).fill({ color: COLORS.red, alpha: 0.25 + 0.2 * Math.sin(clock * 14) });
        if (glow) pieces.roundRect(c.x - s / 2 - 6, c.y - s / 2 - 6, s + 12, s + 12, 14).fill({ color, alpha: 0.25 });
        pieces.roundRect(c.x - s / 2, c.y - s / 2 + 3, s, s, 10).fill({ color: 0x02040c });
        pieces.roundRect(c.x - s / 2, c.y - s / 2, s, s, 10).fill({ color }).stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
        pieces.roundRect(c.x - s * 0.38, c.y - s * 0.34, s * 0.76, s * 0.62, 6).fill({ color: 0x0b1330 });
        if (ai && game.configProblem(m.id)) {
          pieces.circle(c.x + s / 2 - 2, c.y - s / 2 + 2, cell * 0.14).fill({ color: COLORS.orange });
          pieces.rect(c.x + s / 2 - 3, c.y - s / 2 - 4, 2, cell * 0.12).fill({ color: 0x1a1000 });
        }
      }
      refreshMeterLabels();
    };

    let pending: { cell: Cell; meter: number } | null = null;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    const onDown = (e: FederatedPointerEvent) => {
      if (pausedRef.current || game.finished) return;
      audio.unlock();
      const c = cellAt(e.global.x, e.global.y);
      const end = game.endpointAt(c.x, c.y);
      if (end !== null) {
        // A tap opens the settings, a drag starts a cable.
        pending = { cell: c, meter: end };
        return;
      }
      if (game.startDrag(c.x, c.y)) {
        audio.play('tap');
        hover = c;
      }
    };
    const onMove = (e: FederatedPointerEvent) => {
      if (pausedRef.current) return;
      const c = cellAt(e.global.x, e.global.y);
      if (pending) {
        if (c.x === pending.cell.x && c.y === pending.cell.y) return;
        game.startDrag(pending.cell.x, pending.cell.y);
        audio.play('tap');
        pending = null;
        setTip(null);
        props.onTipDone?.();
      }
      if (game.active !== null) {
        hover = c;
        game.dragTo(c.x, c.y);
      }
    };
    const onUp = () => {
      if (pending) {
        audio.play('tap');
        setConfig(pending.meter);
        pending = null;
      }
      hover = null;
      game.endDrag();
      setVersion((v) => v + 1);
    };
    app.stage.on('pointerdown', onDown);
    app.stage.on('globalpointermove', onMove);
    app.stage.on('pointerup', onUp);
    app.stage.on('pointerupoutside', onUp);

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

  const meters = game.puzzle.meters;
  const fillPct = Math.round((game.filled / game.totalCells) * 100);
  const cfgMeter = config !== null ? meters[config] : null;

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={time} onPause={props.onPause}>
        <span class="pill" aria-label="Priklopljeni merilniki">
          {game.onlineCount}/{meters.length}
        </span>
      </Hud>
      <div class="fill-bar" aria-label={`Zapolnjeno ${fillPct} odstotkov plošče`}>
        <i style={{ width: `${fillPct}%` }} class={fillPct === 100 ? 'full' : ''} />
        <span>Kabli zapolnjujejo {fillPct} % plošče</span>
      </div>
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
      <div class="meter-legend" aria-label="Merilniki">
        {meters.map((m) => {
          const st = game.status.get(m.id);
          return (
            <button class={`meter-chip ${st}`} onClick={() => setConfig(m.id)} aria-label={`Nastavi merilnik M${m.id + 1}`}>
              <i style={{ background: css(METER_COLORS[m.id % METER_COLORS.length]) }} />M{m.id + 1} · ID {m.address}
            </button>
          );
        })}
      </div>
      {cfgMeter && (
        <MeterConfig
          game={game}
          meterId={cfgMeter.id}
          onClose={() => setConfig(null)}
          onSave={(address) => {
            game.configure(cfgMeter.id, address);
            setConfig(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

function MeterConfig({ game, meterId, onClose, onSave }: { game: PriklopGame; meterId: number; onClose: () => void; onSave: (address: number) => void }) {
  const m = game.puzzle.meters[meterId];
  const port = game.puzzle.ports[m.port];
  const [address, setAddress] = useState(m.address);
  const taken = new Set(game.puzzle.meters.filter((o) => o.id !== m.id).map((o) => o.address));
  const color = css(METER_COLORS[m.id % METER_COLORS.length]);
  return (
    <Sheet onClose={onClose} label={`Nastavitve merilnika M${m.id + 1}`}>
      <div class="row" style={{ marginBottom: '6px' }}>
        <span class="level-num" style={{ color, borderColor: color }}>
          M{m.id + 1}
        </span>
        <div class="grow">
          <b>{m.device}</b>
          <div class="small muted">
            Vrata {port.id + 1} na prehodu
          </div>
        </div>
      </div>
      <div class="section-title" style={{ marginTop: '12px' }}>
        Modbus naslov
      </div>
      <div class="addr-grid">
        {Array.from({ length: ADDRESS_MAX }, (_, i) => i + 1).map((a) => (
          <button class={`addr${taken.has(a) ? ' taken' : ''}${a === address ? ' sel' : ''}`} onClick={() => (audio.play('tap'), setAddress(a))} aria-pressed={a === address} aria-label={`Naslov ${a}${taken.has(a) ? ', zaseden' : ''}`}>
            {a}
          </button>
        ))}
      </div>
      <button class="btn primary big" onClick={() => onSave(address)}>
        Shrani nastavitve
      </button>
      <p class="tiny muted" style={{ marginTop: '10px', textAlign: 'center' }}>
        {game.isConnected(m.id) ? 'Merilnik je priklopljen: shranjevanje sproži test komunikacije.' : 'Namig: nastavi pred priklopom in prihraniš si iskro.'}
      </p>
    </Sheet>
  );
}
