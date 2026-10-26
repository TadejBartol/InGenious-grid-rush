import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ToplovodParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { E, N, S, ToplovodGame, W, type Tile } from './logic';

const ARMS: [number, string][] = [
  [N, 'M50 50 V-2'],
  [E, 'M50 50 H102'],
  [S, 'M50 50 V102'],
  [W, 'M50 50 H-2'],
];

/** The pipe drawn in its starting orientation; the button rotates it in quarter turns. */
function Pipe({ mask, hot }: { mask: number; hot: boolean }) {
  const d = ARMS.filter(([b]) => mask & b)
    .map(([, p]) => p)
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d={d} class="tp-case" />
      <circle cx="50" cy="50" r="15" class="tp-case-dot" />
      <path d={d} class={`tp-water${hot ? ' hot' : ''}`} />
      <circle cx="50" cy="50" r="8" class={`tp-water-dot${hot ? ' hot' : ''}`} />
    </svg>
  );
}

const HOUSE_ICON: Record<NonNullable<Tile['label']>, string> = { bolnisnica: '🏥', sola: '🏫', blok: '🏢' };

export function ToplovodView(props: GameProps<ToplovodParams>) {
  const game = useMemo(() => new ToplovodGame(props.params), []);
  expose('toplovod', game);
  const { board } = game;
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [glitch, setGlitch] = useState<{ cell: number; id: number } | null>(null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  // Quarter turns per cell, only ever growing, so the CSS rotation always spins clockwise.
  const spins = useRef<number[]>(board.tiles.map(() => 0));
  const shapes = useMemo(() => board.tiles.map((t) => t.mask), []);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);

  const say = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () =>
      game.on((e) => {
        switch (e.type) {
          case 'turn':
            spins.current[e.cell]++;
            audio.play('step');
            break;
          case 'warm':
            audio.play('connect');
            buzz(15);
            break;
          case 'sabotage':
            spins.current[e.cell]++;
            audio.play('spark');
            buzz([60, 30, 60]);
            shake();
            setGlitch({ cell: e.cell, id: Date.now() });
            say('Temni števec je zasukal cev!', 'bad');
            break;
          case 'won':
          case 'timeout':
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
    const won = game.finished === 'won';
    audio.play(won ? 'win' : 'fail');
    const f = game.flow;
    setTimeout(
      () =>
        props.onDone({
          kind: 'toplovod',
          completed: won,
          mistakes: 0,
          timeLeft: Math.round(game.timeLeft),
          timeTotal: game.timeTotal,
          score: f.housesHot * 50 + Math.round(game.timeLeft) * 3 + Math.max(0, board.par * 2 - game.turns) * 5,
          metrics: { turns: game.turns, par: board.par, extra: Math.max(0, game.turns - board.par - game.sabotaged * 3), warm: f.housesHot },
          failHint: won ? undefined : `${f.houses - f.housesHot} ${f.houses - f.housesHot === 1 ? 'stavba je ostala mrzla' : 'stavb je ostalo mrzlih'}`,
          notes: [
            `Toplih stavb: ${f.housesHot}/${f.houses}. Obratov cevi: ${game.turns} (načrt: ${board.par}).`,
            won
              ? 'Vsak konec cevi je zaprt, nič toplote ne uhaja v zemljo.'
              : f.leaks.length
                ? `Odprtih koncev cevi: ${f.leaks.length}. Tam bi vroča voda tekla v zemljo.`
                : 'Nekatere veje še niso povezane s toplarno.',
            game.sabotaged ? `Temni števec je zasukal ${game.sabotaged} ${game.sabotaged === 1 ? 'cev' : 'cevi'}.` : 'Omrežje brez puščanja izgubi le nekaj odstotkov toplote na poti.',
          ],
          emoji: `🔥${'🏢'.repeat(Math.min(6, f.housesHot))}${'🥶'.repeat(Math.min(3, f.houses - f.housesHot))} ${game.turns}↻`,
        }),
      won ? 1100 : 700,
    );
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && !game.finished) {
        game.update(dt);
        acc += dt;
        if (acc > 0.25) {
          acc = 0;
          setFrame((f) => f + 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tap = (cell: number) => {
    if (props.paused) return;
    audio.unlock();
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
    const t = board.tiles[cell];
    if (t.kind === 'pipe' && t.locked) {
      audio.play('wrong');
      say('Ta cev je že privarjena.', 'bad');
      return;
    }
    game.rotate(cell);
  };

  const f = game.flow;
  const leakAt = new Map<number, number>();
  for (const [c, bit] of f.leaks) leakAt.set(c, (leakAt.get(c) ?? 0) | bit);

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.timeLeft} onPause={props.onPause}>
        <span class={`pill${f.housesHot === f.houses ? ' good' : ''}`} aria-label={`Toplih stavb ${f.housesHot} od ${f.houses}`}>
          🔥 {f.housesHot}/{f.houses}
        </span>
        <span class="pill" aria-label={`Obratov ${game.turns}, načrt ${board.par}`}>
          ↻ {game.turns}
        </span>
      </Hud>
      <div class={`stage toplovod-stage${game.finished === 'won' ? ' won' : ''}`} ref={stageRef}>
        <div class="tp-board" style={{ '--cols': board.cols, '--rows': board.rows }}>
          {board.tiles.map((t, i) => {
            const hot = f.hot.has(i);
            const leak = leakAt.get(i) ?? 0;
            const cls = `tp-cell ${t.kind}${hot ? ' hot' : ''}${t.locked ? ' locked' : ''}${glitch?.cell === i ? ' glitch' : ''}`;
            if (t.kind === 'block')
              return (
                <div class={cls} aria-hidden="true">
                  <i class="tp-roof" />
                </div>
              );
            return (
              <button
                class={cls}
                key={glitch?.cell === i ? `${i}-${glitch.id}` : i}
                onPointerDown={(e) => (e.preventDefault(), tap(i))}
                onClick={(e) => e.detail === 0 && tap(i)}
                disabled={t.kind !== 'pipe'}
                aria-label={
                  t.kind === 'source'
                    ? 'Toplarna'
                    : t.kind === 'house'
                      ? `${t.label === 'bolnisnica' ? 'Bolnišnica' : t.label === 'sola' ? 'Šola' : 'Blok'}${hot ? ', topla' : ', mrzla'}`
                      : `Cev${hot ? ' z vročo vodo' : ''}`
                }
              >
                <span class="tp-spin" style={{ transform: `rotate(${spins.current[i] * 90}deg)` }}>
                  <Pipe mask={shapes[i]} hot={hot} />
                </span>
                {t.kind === 'source' && <span class="tp-icon">🏭</span>}
                {t.kind === 'house' && <span class={`tp-icon${hot ? ' warm' : ''}`}>{HOUSE_ICON[t.label ?? 'blok']}</span>}
                {leak & N ? <i class="tp-leak n" /> : null}
                {leak & E ? <i class="tp-leak e" /> : null}
                {leak & S ? <i class="tp-leak s" /> : null}
                {leak & W ? <i class="tp-leak w" /> : null}
              </button>
            );
          })}
        </div>
        <p class="tp-status" role="status">
          {f.housesHot === f.houses && f.leaks.length
            ? `Vse stavbe so tople, a ${f.leaks.length === 1 ? 'en konec pušča' : `${f.leaks.length} koncev pušča`}. Zapri jih.`
            : `Tapni cev, da jo zasukaš. Vroča voda mora priti do vseh stavb.`}
        </p>
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
