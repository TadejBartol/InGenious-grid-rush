import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { UrnikParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { fmt } from '../../core/format';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, sparkline, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { blockHours, blockLabel, checkPlan, UrnikGame } from './logic';

const eur = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;

export function UrnikView(props: GameProps<UrnikParams>) {
  const game = useMemo(() => new UrnikGame(props.params), []);
  expose('urnik', game);
  const day = game.day;
  const [, setFrame] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const paint = useRef<{ unit: number; on: boolean } | null>(null);
  const lastProblem = useRef('');

  useEffect(
    () =>
      game.on((e) => {
        if (e.type === 'run') {
          audio.play(game.check.valid ? 'go' : 'alarm');
          if (!game.check.valid) buzz([80, 40, 80]);
        }
        if (e.type === 'finished') finish();
      }),
    [],
  );

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const c = game.check;
    const completed = game.passed;
    const gap = Math.max(0, day.best - c.profit);
    audio.play(completed ? 'win' : 'fail');
    setTimeout(
      () =>
        props.onDone({
          kind: 'urnik',
          completed,
          mistakes: c.cold.length + c.overflow.length,
          timeLeft: Math.round(game.timeLeft),
          timeTotal: game.timeTotal,
          score: Math.max(0, c.profit) * 4 + Math.round(game.timeLeft),
          metrics: { profit: c.profit, gap, starts: c.starts },
          failHint: completed ? undefined : !c.valid ? 'urnik ni bil veljaven' : `še ${fmt(day.pass - c.profit)} € dobička`,
          notes: [
            `Dobiček dneva: ${fmt(c.profit)} €. Najboljši možni urnik: ${fmt(day.best)} €.`,
            gap === 0 ? 'Našel si najboljši vozni red. Dispečer bi bil ponosen.' : `Do najboljšega urnika manjka ${fmt(gap)} €. Poglej, ali je motor tekel v kakšnem poceni bloku.`,
            day.startCost ? `Zagonov motorja: ${c.starts}, vsak stane ${day.startCost} € obrabe.` : `Motor je tekel ${game.plan.flat().filter(Boolean).length} od ${day.blocks * day.units} blokov.`,
          ],
          emoji: `🔥${sparkline(day.margin, 8)} ${completed ? '💶' : '📉'} ${gap === 0 ? '🏆' : `${Math.round((c.profit / day.best) * 100)}%`}`,
        }),
      700,
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
        const before = Math.floor(game.replay);
        game.update(dt);
        if (game.submitted && Math.floor(game.replay) !== before && game.replay < day.blocks) audio.play('step');
        acc += dt;
        if (acc > (game.submitted ? 0.03 : 0.25)) {
          acc = 0;
          setFrame((f) => f + 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const touched = () => {
    audio.unlock();
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
  };

  const afterEdit = () => {
    const c = game.check;
    const problem = c.cold.length ? 'cold' : c.overflow.length ? 'over' : '';
    if (problem && problem !== lastProblem.current) {
      audio.play('wrong');
      buzz(30);
      shake();
    } else audio.play('tap');
    lastProblem.current = problem;
    setFrame((f) => f + 1);
  };

  // Tap toggles a block; dragging along the row paints the same state over the next blocks.
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-block]') as HTMLElement | null;
    return el ? { unit: Number(el.dataset.unit), block: Number(el.dataset.block) } : null;
  };
  const down = (e: PointerEvent) => {
    if (props.paused || game.submitted) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    touched();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const on = !game.plan[c.unit][c.block];
    paint.current = { unit: c.unit, on };
    if (game.set(c.unit, c.block, on)) afterEdit();
  };
  const move = (e: PointerEvent) => {
    if (!paint.current) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c && c.unit === paint.current.unit && game.set(c.unit, c.block, paint.current.on)) afterEdit();
  };
  const up = () => (paint.current = null);

  const c = game.check;
  const run = () => {
    touched();
    if (!game.submit()) return;
    setFrame((f) => f + 1);
  };
  const clear = () => {
    touched();
    game.clear();
    lastProblem.current = '';
    audio.play('tap');
    setFrame((f) => f + 1);
  };

  const replay = game.submitted ? Math.floor(game.replay) : -1;
  // During the replay the money counts up block by block.
  const shownProfit = game.submitted
    ? checkPlan(
        day,
        game.plan.map((r) => r.map((v, i) => (i < replay ? v : 0))),
      ).profit
    : c.profit;
  const maxM = Math.max(...day.margin.map(Math.abs), 1);
  const maxD = Math.max(...day.demand, 1);
  const hb = blockHours(day.blocks);
  const at = (i: number) => `${blockLabel(day.blocks, i)}:00`;
  const status = !c.valid
    ? c.cold.length
      ? `Ob ${at(c.cold[0])} bodo radiatorji mrzli. Prižgi motor prej ali prihrani toploto.`
      : c.overflow.length
        ? `Ob ${at(c.overflow[0])} se hranilnik prelije. Motor tam ugasni ali ga prej izprazni.`
        : `Hranilnik mora dan končati z vsaj ${day.start} ${day.start === 1 ? 'enoto' : 'enotami'} toplote za jutri.`
    : c.profit >= day.best
      ? 'Najboljši možni urnik! Zaženi dan.'
      : c.profit >= day.pass
        ? `Urnik je dober. Do najboljšega manjka ${day.best - c.profit} €.`
        : `Radiatorji so topli. Za cilj manjka še ${day.pass - c.profit} € dobička.`;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / day.best) * 100))}%`;
  const unitName = (u: number) => (day.units > 1 ? `Motor ${u === 0 ? 'A' : 'B'}` : 'Motor');

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.submitted ? null : game.timeLeft} onPause={props.onPause}>
        <span class={`pill${c.valid && c.profit >= day.pass ? ' good' : ''}`} aria-label={`Dobiček ${c.profit} evrov`}>
          💶 {eur(shownProfit)} €
        </span>
      </Hud>
      <div class={`stage urnik-stage${game.submitted ? ' running' : ''}`} ref={stageRef}>
        <div class="urn-goal" aria-label={`Cilj ${day.pass} evrov, najboljše ${day.best} evrov`}>
          <div class="urn-bar">
            <i class={`urn-fill${c.valid ? '' : ' bad'}`} style={{ width: pct(Math.max(0, shownProfit)) }} />
            <span class="urn-mark pass" style={{ left: pct(day.pass) }} />
          </div>
          <div class="urn-goal-row">
            <span>
              Cilj <b class="mono">{day.pass} €</b>
            </span>
            <span>
              Najboljši urnik <b class="mono">{day.best} €</b>
            </span>
          </div>
        </div>

        <div class="urn-board" style={{ '--n': day.blocks }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div class="urn-label">
            Zaslužek na blok <small>(€ za {hb} h vožnje)</small>
          </div>
          <div class="urn-row urn-margin">
            {day.margin.map((m, i) => (
              <span class={`${m < 0 ? 'neg' : ''}${day.spikes.includes(i) ? ' spike' : ''}${i === replay ? ' now' : ''}`}>
                <i style={{ '--h': Math.abs(m) / maxM }} />
                <b class="mono">{eur(m)}</b>
              </span>
            ))}
          </div>

          {game.plan.map((row, u) => (
            <>
              <div class="urn-label">
                {unitName(u)} <small>(tapni ali povleci)</small>
              </div>
              <div class="urn-row urn-motor">
                {row.map((on, i) => (
                  <button
                    data-block={i}
                    data-unit={u}
                    class={`${on ? 'on' : ''}${day.locked[u][i] ? ' locked' : ''}${i === replay ? ' now' : ''}`}
                    disabled={day.locked[u][i] || game.submitted}
                    onClick={(e) => e.detail === 0 && !props.paused && (touched(), game.toggle(u, i) && afterEdit())}
                    aria-pressed={!!on}
                    aria-label={`${unitName(u)} ob ${at(i)}: ${day.locked[u][i] ? 'servis' : on ? 'teče' : 'stoji'}`}
                  >
                    {day.locked[u][i] ? '🔧' : on ? '🔥' : ''}
                  </button>
                ))}
              </div>
            </>
          ))}

          <div class="urn-label">Odjem toplote</div>
          <div class="urn-row urn-demand">
            {day.demand.map((d) => (
              <span style={{ '--h': d / maxD }} aria-label={`odjem ${d}`}>
                <i />
                <b class="mono">{d}</b>
              </span>
            ))}
          </div>

          <div class="urn-label">
            Hranilnik <small>(prostora za {day.capacity})</small>
          </div>
          <div class="urn-row urn-tank">
            {c.tank.map((t, i) => {
              const bad = c.cold.includes(i) ? ' cold' : c.overflow.includes(i) ? ' over' : '';
              const hidden = game.submitted && i >= replay;
              return (
                <span class={`${bad}${hidden ? ' later' : ''}`} style={{ '--h': t / day.capacity }}>
                  <i />
                  <b class="mono">{bad === ' cold' ? '❄' : bad === ' over' ? '!' : t}</b>
                </span>
              );
            })}
          </div>
          <div class="urn-row urn-hours" aria-hidden="true">
            {day.margin.map((_, i) => (
              <span>{i % (day.blocks > 8 ? 2 : 1) === 0 ? blockLabel(day.blocks, i) : ''}</span>
            ))}
          </div>
        </div>

        <p class={`urn-status${c.valid ? (c.profit >= day.pass ? ' good' : '') : ' bad'}`} role="status">
          {game.submitted ? (c.valid ? 'Dan teče po tvojem voznem redu …' : 'Čas je potekel, urnik ni veljaven.') : status}
        </p>
        <div class="urn-actions">
          <button class="btn" onClick={clear} disabled={game.submitted}>
            Počisti
          </button>
          <button class={`btn ${c.valid ? 'green' : ''} big grow`} onClick={run} disabled={game.submitted || !c.valid}>
            Zaženi dan ▶
          </button>
        </div>

        {tip && (
          <div class="hint">
            <GenkoSays text={tip} size={44} />
          </div>
        )}
      </div>
    </>
  );
}
