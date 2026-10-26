import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PolnilnicaParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { chargersFor, plugProblem, PolnilnicaGame, SIZE, slideRange, usedKw, type Move, type Side } from './logic';

const CAR_COLORS = ['#8b98c4', '#c9a26b', '#9d7fd1', '#6f9fb8', '#b87f8a', '#7fb88f', '#c4b46a'];
const PLUG_TEXT = { battery: 'Baterija je prazna.', busy: 'Polnilnica je še zasedena.', limit: 'Priključek bi presegel mejo moči.' };

type Drag = { vehicle: number; startX: number; startY: number; base: number; lo: number; hi: number; exitLo: boolean; exitHi: boolean; offset: number; cell: number };

export function PolnilnicaView(props: GameProps<PolnilnicaParams>) {
  const game = useMemo(() => new PolnilnicaGame(props.params, props.research.baterija ?? 0), []);
  expose('polnilnica', game);
  const { lot } = game;
  const [, setFrame] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [leaving, setLeaving] = useState<{ vehicle: number; side: Side; id: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const lotRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const say = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      game.on((e) => {
        switch (e.type) {
          case 'move':
            audio.play('step');
            break;
          case 'plug':
            audio.play('connect');
            buzz(25);
            setLeaving({ vehicle: e.vehicle, side: lot.chargers[e.charger].side, id: Date.now() });
            say(`Polnjenje na ${lot.chargers[e.charger].kw} kW ⚡`, 'good');
            break;
          case 'flat':
            audio.play('wrong');
            buzz([60, 30, 60]);
            shake();
            say('Baterija prazna! Razveljavi potezo.', 'bad');
            break;
          case 'dark':
            audio.play('spark');
            break;
          case 'won':
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
    audio.play('win');
    const moves = game.state.moves;
    const over = Math.max(0, moves - game.par);
    setTimeout(
      () =>
        props.onDone({
          kind: 'polnilnica',
          completed: true,
          mistakes: 0,
          timeLeft: 0,
          timeTotal: 0,
          score: Math.max(50, 600 - over * 40 - game.hints * 80),
          metrics: { moves, par: game.par, overPar: over, hints: game.hints, undos: game.undos },
          notes: [
            `Potez: ${moves}, najkrajša rešitev: ${game.par}.`,
            over === 0
              ? 'Najkrajša možna pot. Tudi računalnik ne bi bil hitrejši.'
              : `Do najkrajše rešitve ${over} ${over === 1 ? 'poteza' : over === 2 ? 'potezi' : over < 5 ? 'poteze' : 'potez'} preveč.`,
            game.hints ? `Namigov: ${game.hints}.` : 'Brez enega samega namiga.',
          ],
          emoji: `🚗⚡${'🔌'.repeat(lot.vehicles.filter((v) => v.type === 'ev').length)} ${moves}/${game.par}${game.hints ? ' 💡' : ' ✨'}`,
        }),
      1100,
    );
  };

  const touched = () => {
    audio.unlock();
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
  };

  const down = (e: PointerEvent, i: number) => {
    const v = lot.vehicles[i];
    if (props.paused || game.finished || v.type === 'dark' || game.state.pos[i] < 0) return;
    touched();
    if (v.type === 'ev' && game.state.battery[i] <= 0) {
      audio.play('wrong');
      say('Baterija je prazna.', 'bad');
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = slideRange(lot, game.state, i);
    const cell = (lotRef.current?.getBoundingClientRect().width ?? 300) / SIZE;
    const ends = v.type === 'ev' ? chargersFor(lot, v) : [];
    const exitLo = r.atStart && ends.some((c) => c.side === 'W' || c.side === 'N');
    const exitHi = r.atEnd && ends.some((c) => c.side === 'E' || c.side === 'S');
    setHint(null);
    setDrag({ vehicle: i, startX: e.clientX, startY: e.clientY, base: game.state.pos[i], lo: r.lo, hi: r.hi, exitLo, exitHi, offset: game.state.pos[i], cell });
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const v = lot.vehicles[drag.vehicle];
    const d = (v.dir === 'h' ? e.clientX - drag.startX : e.clientY - drag.startY) / drag.cell;
    // Past the free range only towards a charger, and only a little: the car noses into the bay.
    const min = drag.exitLo ? drag.lo - 1.2 : drag.lo;
    const max = drag.exitHi ? drag.hi + 1.2 : drag.hi;
    setDrag({ ...drag, offset: Math.max(min, Math.min(max, drag.base + d)) });
  };
  const up = () => {
    if (!drag) return;
    const i = drag.vehicle;
    const v = lot.vehicles[i];
    setDrag(null);
    const exitSide = drag.offset < drag.lo - 0.45 ? 'lo' : drag.offset > drag.hi + 0.45 ? 'hi' : null;
    if (exitSide) {
      const charger = chargersFor(lot, v).find((c) => (exitSide === 'lo' ? c.side === 'W' || c.side === 'N' : c.side === 'E' || c.side === 'S'))!;
      const problem = plugProblem(lot, game.state, i, charger.id);
      if (problem) {
        audio.play('wrong');
        buzz(40);
        shake();
        say(PLUG_TEXT[problem], 'bad');
        return;
      }
      game.play({ vehicle: i, to: -1, charger: charger.id });
      return;
    }
    const to = Math.round(Math.max(drag.lo, Math.min(drag.hi, drag.offset)));
    if (to !== drag.base) game.play({ vehicle: i, to });
    setFrame((f) => f + 1);
  };

  const undo = () => {
    touched();
    if (game.undo()) {
      audio.play('tap');
      setHint(null);
      setFrame((f) => f + 1);
    }
  };
  const askHint = () => {
    touched();
    const m = game.hint();
    if (!m) {
      audio.play('wrong');
      say('Od tu ni več poti. Razveljavi nekaj potez.', 'bad');
      return;
    }
    audio.play('unlock');
    setHint(m);
  };

  const s = game.state;
  const kw = usedKw(lot, s.busy);
  const finite = Number.isFinite(lot.limitKw);
  const evsLeft = lot.vehicles.filter((v, i) => v.type === 'ev' && s.pos[i] >= 0).length;
  const pct = (n: number) => `${(n / SIZE) * 100}%`;

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={null} onPause={props.onPause}>
        <span class="pill" aria-label={`Potez ${s.moves}, najmanj ${game.par}`}>
          ↔ {s.moves}/{game.par}
        </span>
        {finite && (
          <span class={`pill${kw > 0 ? ' warn' : ''}`} aria-label={`Moč ${kw} od ${lot.limitKw} kW`}>
            ⚡ {kw}/{lot.limitKw}
          </span>
        )}
      </Hud>
      <div class="stage polnilnica-stage" ref={stageRef}>
        <div class="pn-wrap">
          <div class="pn-lot" ref={lotRef} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {Array.from({ length: SIZE * SIZE }, (_, k) => (
              <i class="pn-slot" style={{ left: pct(k % SIZE), top: pct(Math.floor(k / SIZE)) }} />
            ))}
            {lot.chargers.map((c) => {
              const busy = s.busy[c.id];
              const style =
                c.side === 'E'
                  ? { left: '100%', top: pct(c.line) }
                  : c.side === 'W'
                    ? { right: '100%', top: pct(c.line) }
                    : c.side === 'N'
                      ? { bottom: '100%', left: pct(c.line) }
                      : { top: '100%', left: pct(c.line) };
              return (
                <div class={`pn-bay ${c.side}${busy ? ' busy' : ''}`} style={style} aria-label={`Polnilnica ${c.kw} kW${busy ? ', zasedena' : ''}`}>
                  <b>⚡</b>
                  <small>{c.kw}</small>
                  {busy > 0 && <span class="pn-busy">{busy}</span>}
                </div>
              );
            })}
            {lot.vehicles.map((v, i) => {
              const gone = s.pos[i] < 0;
              const isLeaving = leaving?.vehicle === i;
              if (gone && !isLeaving) return null;
              const off = drag?.vehicle === i ? drag.offset : gone ? (leaving!.side === 'W' || leaving!.side === 'N' ? -v.len - 0.4 : SIZE + 0.4) : s.pos[i];
              const x = v.dir === 'h' ? off : v.line;
              const y = v.dir === 'h' ? v.line : off;
              const w = v.dir === 'h' ? v.len : 1;
              const h = v.dir === 'h' ? 1 : v.len;
              const hinted = hint?.vehicle === i;
              return (
                <button
                  class={`pn-car ${v.type} ${v.dir}${drag?.vehicle === i ? ' dragging' : ''}${isLeaving && gone ? ' leaving' : ''}${hinted ? ' hinted' : ''}${v.type === 'ev' && s.battery[i] <= 0 ? ' flat' : ''}`}
                  key={i}
                  style={{ left: pct(x), top: pct(y), width: pct(w), height: pct(h), '--c': CAR_COLORS[i % CAR_COLORS.length] }}
                  onPointerDown={(e) => down(e, i)}
                  aria-label={v.type === 'ev' ? `Električni avto, baterija ${s.battery[i]}` : v.type === 'truck' ? 'Tovornjak' : v.type === 'dark' ? 'Črni avto Temnega števca' : 'Avto'}
                >
                  <span class="pn-body">
                    {v.type === 'ev' && <b class="pn-bolt">⚡</b>}
                    {v.type === 'dark' && <b class="pn-eyes">● ●</b>}
                    {v.type === 'ev' && lot.battery < 50 && <small class="pn-batt">🔋{Math.max(0, s.battery[i])}</small>}
                  </span>
                </button>
              );
            })}
            {hint && hint.to >= 0 && (
              <i
                class={`pn-ghost ${lot.vehicles[hint.vehicle].dir}`}
                style={{
                  left: pct(lot.vehicles[hint.vehicle].dir === 'h' ? hint.to : lot.vehicles[hint.vehicle].line),
                  top: pct(lot.vehicles[hint.vehicle].dir === 'h' ? lot.vehicles[hint.vehicle].line : hint.to),
                  width: pct(lot.vehicles[hint.vehicle].dir === 'h' ? lot.vehicles[hint.vehicle].len : 1),
                  height: pct(lot.vehicles[hint.vehicle].dir === 'h' ? 1 : lot.vehicles[hint.vehicle].len),
                }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
        <p class="pn-status" role="status">
          {hint
            ? hint.to < 0
              ? 'Namig: zapelji ta avto na polnilnico.'
              : 'Namig: premakni označeno vozilo na obrobljeno mesto.'
            : `Še ${evsLeft} ${evsLeft === 1 ? 'avto' : evsLeft === 2 ? 'avta' : 'avtomobili'} do polnilnice. Vozila drsaš le naprej in nazaj.`}
        </p>
        <div class="pn-actions">
          <button class="btn" onClick={undo} disabled={!game.history.length || game.finished}>
            ↶ Razveljavi
          </button>
          <button class="btn" onClick={askHint} disabled={game.finished}>
            💡 Namig
          </button>
        </div>
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
    </>
  );
}
