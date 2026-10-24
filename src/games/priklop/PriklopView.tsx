import { Container, Graphics, type FederatedPointerEvent, type Text } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PriklopParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Sheet } from '../../ui/components/Common';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { COLORS, Floaters, label, MONO, Particles, usePixi } from '../shared/pixi';
import { ADDRESS_MAX, BAUDS, PriklopGame, type Cell } from './logic';
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
          showToast(e.reason === 'address' ? `Iskra! M${e.meter + 1}: naslov ${m!.address} je že zaseden` : `Iskra! M${e.meter + 1}: napačna hitrost`, 'bad');
          setVersion((v) => v + 1);
          break;
        case 'dropout':
          audio.play('alarm');
          buzz([60, 40, 60]);
          fx.current?.spark(e.cell, COLORS.orange);
          showToast(`Izpad komunikacije! Ponovno priklopi M${e.meter + 1}`, 'bad');
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
    const labels = new Container();
    const cables = new Graphics();
    const dots = new Graphics();
    const pieces = new Graphics();
    const particles = new Particles();
    particles.reduced = props.reducedMotion;
    const floaters = new Floaters();
    root.addChild(board, cables, dots, pieces, labels, particles.layer, floaters.layer);

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
      const top = 54;
      cell = Math.floor(Math.min((w - 24) / cols, (h - top - 16) / rows));
      ox = Math.floor((w - cell * cols) / 2);
      // Board hugs the top; the free space below is where Genko's hints live.
      oy = top;
      drawBoard();
    };

    const drawBoard = () => {
      board.clear();
      for (const t of labels.removeChildren()) t.destroy();
      // Plant floor
      board.roundRect(ox - 6, oy + cell - 6, cols * cell + 12, (rows - 1) * cell + 12, 14).fill({ color: 0x0a1028 }).stroke({ color: COLORS.line, width: 1 });
      for (let y = 1; y < rows; y++)
        for (let x = 0; x < cols; x++) board.roundRect(ox + x * cell + 3, oy + y * cell + 3, cell - 6, cell - 6, 6).fill({ color: 0x0e1636 });
      // Gateway housing across the top row
      board.roundRect(ox - 6, oy - 4, cols * cell + 12, cell + 4, 12).fill({ color: 0x1a2756 }).stroke({ color: COLORS.brand, width: 1.5, alpha: 0.6 });
      const title = label('InGenious prehod', { fontSize: 13, fontWeight: '700', fill: COLORS.brand, letterSpacing: 1 });
      title.position.set(ox, oy - 28);
      labels.addChild(title);
      const led = new Graphics().circle(ox + cols * cell - 8, oy - 20, 4).fill({ color: COLORS.green });
      labels.addChild(led);
      for (const k of game.puzzle.obstacles) {
        const x = k % cols;
        const y = Math.floor(k / cols);
        if (y === 0) continue;
        const px = ox + x * cell;
        const py = oy + y * cell;
        board.roundRect(px + 4, py + 4, cell - 8, cell - 8, 6).fill({ color: 0x232c52 }).stroke({ color: 0x343f74, width: 1 });
        // hazard stripes: a machine you cannot cable through
        for (let i = 1; i < 4; i++) board.moveTo(px + 6 + (i * (cell - 12)) / 4, py + cell - 8).lineTo(px + 6 + ((i - 1) * (cell - 12)) / 4, py + 8).stroke({ color: 0x3b4680, width: 2 });
      }
      for (const port of game.puzzle.ports) {
        const c = center(port);
        const color = METER_COLORS[port.id % METER_COLORS.length];
        board.circle(c.x, c.y - 4, cell * 0.26).fill({ color: 0x070b1a }).stroke({ color, width: 3 });
        const n = label(String(port.id + 1), { fontFamily: MONO, fontSize: Math.max(11, cell * 0.24), fontWeight: '800', fill: color });
        n.anchor.set(0.5);
        n.position.set(c.x, c.y - 4);
        const b = label(`${port.baud}`, { fontFamily: MONO, fontSize: Math.max(8, cell * 0.16), fill: COLORS.muted });
        b.anchor.set(0.5, 0);
        b.position.set(c.x, c.y + cell * 0.22);
        labels.addChild(n, b);
      }
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const t = label(`M${m.id + 1}`, { fontFamily: MONO, fontSize: Math.max(11, cell * 0.26), fontWeight: '800', fill: 0xffffff });
        t.anchor.set(0.5);
        t.position.set(c.x, c.y - cell * 0.06);
        const id = label(`ID ${m.address}`, { fontFamily: MONO, fontSize: Math.max(8, cell * 0.16), fill: COLORS.muted });
        id.anchor.set(0.5, 0);
        id.position.set(c.x, c.y + cell * 0.16);
        (id as Text & { meterId?: number }).meterId = m.id;
        labels.addChild(t, id);
      }
    };

    const refreshMeterLabels = () => {
      for (const child of labels.children) {
        const t = child as Text & { meterId?: number };
        if (t.meterId !== undefined) {
          const m = game.puzzle.meters[t.meterId];
          const text = `ID ${m.address}`;
          if (t.text !== text) t.text = text;
        }
      }
    };

    let clock = 0;
    const draw = () => {
      cables.clear();
      dots.clear();
      pieces.clear();
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
        const flicker = status === 'error' ? 0.5 + 0.5 * Math.sin(clock * 20) : 1;
        stroke(cell * 0.34, status === 'error' ? COLORS.red : color, 0.18 * flicker);
        stroke(cell * 0.13, status === 'error' ? COLORS.red : color, 0.95 * flicker);
        if (status === 'online') {
          // Data particles travel from meter to gateway: you literally see acquisition.
          const len = pts.length - 1;
          for (let k = 0; k < Math.max(2, Math.floor(len / 2)); k++) {
            const u = ((clock * 2.2 + (k * len) / Math.max(2, Math.floor(len / 2))) % len + len) % len;
            const i = Math.floor(u);
            const f = u - i;
            const x = pts[i].x + (pts[i + 1].x - pts[i].x) * f;
            const y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
            dots.circle(x, y, cell * 0.09).fill({ color: 0xffffff, alpha: 0.95 });
            dots.circle(x, y, cell * 0.2).fill({ color, alpha: 0.25 });
          }
        }
      }
      for (const m of game.puzzle.meters) {
        const c = center(m);
        const color = METER_COLORS[m.id % METER_COLORS.length];
        const status = game.status.get(m.id);
        const s = cell * 0.8;
        if (status === 'online') pieces.roundRect(c.x - s / 2 - 4, c.y - s / 2 - 4, s + 8, s + 8, 12).fill({ color: COLORS.green, alpha: 0.18 + 0.08 * Math.sin(clock * 4) });
        if (status === 'error') pieces.roundRect(c.x - s / 2 - 4, c.y - s / 2 - 4, s + 8, s + 8, 12).fill({ color: COLORS.red, alpha: 0.25 + 0.2 * Math.sin(clock * 14) });
        pieces.roundRect(c.x - s / 2, c.y - s / 2, s, s, 10).fill({ color: 0x111a3d }).stroke({ color, width: 3 });
        if (ai && game.configProblem(m.id)) {
          pieces.circle(c.x + s / 2 - 2, c.y - s / 2 + 2, cell * 0.14).fill({ color: COLORS.orange });
          pieces.rect(c.x + s / 2 - 3, c.y - s / 2 - 4, 2, cell * 0.12).fill({ color: 0x1a1000 });
        }
      }
      refreshMeterLabels();
    };

    let pending: { meter: number; cell: Cell } | null = null;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    const onDown = (e: FederatedPointerEvent) => {
      if (pausedRef.current || game.finished) return;
      audio.unlock();
      const c = cellAt(e.global.x, e.global.y);
      const meter = game.meterAt(c.x, c.y);
      if (meter) {
        pending = { meter: meter.id, cell: c };
        return;
      }
      if (game.startDrag(c.x, c.y)) audio.play('tap');
    };
    const onMove = (e: FederatedPointerEvent) => {
      if (pausedRef.current) return;
      const c = cellAt(e.global.x, e.global.y);
      if (pending) {
        if (c.x === pending.cell.x && c.y === pending.cell.y) return;
        game.startDrag(pending.cell.x, pending.cell.y);
        pending = null;
        setTip(null);
        props.onTipDone?.();
      }
      if (game.active !== null) game.dragTo(c.x, c.y);
    };
    const onUp = () => {
      if (pending) {
        audio.play('tap');
        setConfig(pending.meter);
        pending = null;
      }
      game.endDrag();
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
  const cfgMeter = config !== null ? meters[config] : null;

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={time} onPause={props.onPause}>
        <span class="pill" aria-label="Priklopljeni merilniki">
          {game.onlineCount}/{meters.length}
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
      <div class="meter-legend" aria-label="Merilniki">
        {meters.map((m) => {
          const st = game.status.get(m.id);
          return (
            <button class={`meter-chip ${st}`} onClick={() => setConfig(m.id)} aria-label={`Nastavi merilnik M${m.id + 1}`}>
              <i style={{ background: css(METER_COLORS[m.id % METER_COLORS.length]) }} />M{m.id + 1} · ID {m.address} · {m.baud}
            </button>
          );
        })}
      </div>
      {cfgMeter && (
        <MeterConfig
          game={game}
          meterId={cfgMeter.id}
          onClose={() => setConfig(null)}
          onSave={(address, baud) => {
            game.configure(cfgMeter.id, address, baud);
            setConfig(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

function MeterConfig({ game, meterId, onClose, onSave }: { game: PriklopGame; meterId: number; onClose: () => void; onSave: (address: number, baud: number) => void }) {
  const m = game.puzzle.meters[meterId];
  const port = game.puzzle.ports[m.port];
  const [address, setAddress] = useState(m.address);
  const [baud, setBaud] = useState(m.baud);
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
            Vrata {port.id + 1} na prehodu · pričakujejo {port.baud} Bd
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
      <div class="section-title">Hitrost (baud)</div>
      <div class="baud-row">
        {BAUDS.map((b) => (
          <button class={`baud${b === baud ? ' sel' : ''}${b === port.baud ? ' match' : ''}`} onClick={() => (audio.play('tap'), setBaud(b))} aria-pressed={b === baud}>
            {b}
          </button>
        ))}
      </div>
      <button class="btn primary big" onClick={() => onSave(address, baud)}>
        Shrani nastavitve
      </button>
      <p class="tiny muted" style={{ marginTop: '10px', textAlign: 'center' }}>
        {game.isConnected(m.id) ? 'Merilnik je priklopljen: shranjevanje sproži test komunikacije.' : 'Namig: nastavi pred priklopom in prihraniš si iskro.'}
      </p>
    </Sheet>
  );
}
