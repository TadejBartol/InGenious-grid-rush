import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PuscanjeParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { PuscanjeGame } from './logic';

type Mode = 'inspect' | 'valve';

export function PuscanjeView(props: GameProps<PuscanjeParams>) {
  const game = useMemo(() => new PuscanjeGame({ ...props.params, camera: (props.params.camera ?? 0) + (props.research.termokamera ?? 0) }), []);
  expose('puscanje', game);
  const { field } = game;
  const [, setFrame] = useState(0);
  const [mode, setMode] = useState<Mode>('inspect');
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [flash, setFlash] = useState<{ cell: number; kind: 'burst' | 'wrong' | 'cam'; id: number } | null>(null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);
  const press = useRef<{ cell: number; timer: number; long: boolean } | null>(null);

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
          case 'open':
            audio.play(e.count === 0 ? 'connect' : 'step');
            break;
          case 'closed':
            audio.play('coin');
            buzz(20);
            break;
          case 'burst':
            audio.play('alarm');
            buzz([90, 40, 90]);
            shake();
            setFlash({ cell: e.cell, kind: 'burst', id: Date.now() });
            say('Prekop je zadel puščanje! Napaka.', 'bad');
            break;
          case 'wrongValve':
            audio.play('wrong');
            buzz([40, 30, 40]);
            shake();
            setFlash({ cell: e.cell, kind: 'wrong', id: Date.now() });
            say('Tu ni puščanja. Napaka.', 'bad');
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
    const found = game.leaksTotal - game.leaksLeft;
    setTimeout(
      () =>
        props.onDone({
          kind: 'puscanje',
          completed: won,
          mistakes: game.mistakes,
          timeLeft: Math.round(game.timeLeft),
          timeTotal: game.timeTotal,
          score: found * 40 + Math.round(game.timeLeft) * 3 - game.mistakes * 30,
          metrics: { found, leaks: game.leaksTotal, camera: game.camera },
          failHint: won ? undefined : `še ${game.leaksLeft} ${game.leaksLeft === 1 ? 'puščanje' : 'puščanj'}`,
          notes: [
            `Najdenih puščanj: ${found}/${game.leaksTotal}.`,
            game.mistakes ? `Napačnih posegov: ${game.mistakes}. Vsak prekop na slepo stane cel delovni dan ekipe.` : 'Brez enega samega nepotrebnega prekopa. Čisto delo po številkah.',
            'Števci toplote na vozliščih povedo, kje voda izgine. Brez njih bi kopali po vsej ulici.',
          ],
          emoji: `🔧${'💧'.repeat(Math.min(6, found))}${game.mistakes ? ' 💥'.repeat(Math.min(3, game.mistakes)) : ' ✨'}`,
        }),
      won ? 1000 : 700,
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

  const touched = () => {
    audio.unlock();
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
  };
  const act = (cell: number, as: Mode) => {
    if (props.paused || game.finished) return;
    touched();
    if (as === 'inspect') game.inspect(cell);
    else game.close(cell);
  };
  // Tap uses the chosen tool; a long press always closes a valve.
  const down = (cell: number) => {
    if (game.state[cell] !== 'hidden') return;
    const timer = window.setTimeout(() => {
      if (!press.current) return;
      press.current.long = true;
      buzz(25);
      act(cell, 'valve');
    }, 420);
    press.current = { cell, timer, long: false };
  };
  const up = (cell: number) => {
    const p = press.current;
    press.current = null;
    if (!p || p.cell !== cell) return;
    clearTimeout(p.timer);
    if (!p.long) act(cell, mode);
  };
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const camera = () => {
    touched();
    const cell = game.useCamera();
    if (cell === null) return;
    audio.play('unlock');
    setFlash({ cell, kind: 'cam', id: Date.now() });
    setFrame((f) => f + 1);
  };

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.timeLeft} onPause={props.onPause}>
        <span class={`pill${game.leaksLeft === 0 ? ' good' : ''}`} aria-label={`Še ${game.leaksLeft} puščanj`}>
          💧 {game.leaksLeft}
        </span>
      </Hud>
      <div class="stage puscanje-stage" ref={stageRef}>
        <div class="ps-board" style={{ '--cols': field.cols, '--rows': field.rows }} onPointerLeave={cancel}>
          {field.leak.map((_, i) => {
            const st = game.state[i];
            const n = field.count[i];
            const fl = flash?.cell === i ? ` fx-${flash.kind}` : '';
            return (
              <button
                key={flash?.cell === i ? `${i}-${flash.id}` : i}
                class={`ps-cell ${st}${st === 'open' ? ` n${Math.min(n, 5)}` : ''}${fl}`}
                onPointerDown={(e) => (e.preventDefault(), down(i))}
                onPointerUp={() => up(i)}
                onPointerCancel={cancel}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => e.detail === 0 && act(i, mode)}
                aria-label={st === 'open' ? `Števec: ${n}` : st === 'closed' ? 'Zaprt ventil' : st === 'burst' ? 'Počena cev, ventil zaprt' : 'Neznan odsek'}
              >
                {st === 'open' && n > 0 && <b>{n}</b>}
                {st === 'open' && field.start.includes(i) && <i class="ps-meter" />}
                {(st === 'closed' || st === 'burst') && <span class="ps-valve">🔧</span>}
              </button>
            );
          })}
        </div>
        <div class="ps-tools" role="radiogroup" aria-label="Orodje">
          <button class={`btn ps-tool${mode === 'inspect' ? ' on' : ''}`} role="radio" aria-checked={mode === 'inspect'} onClick={() => (audio.play('tap'), setMode('inspect'))}>
            🔍 Preglej
          </button>
          <button class={`btn ps-tool valve${mode === 'valve' ? ' on' : ''}`} role="radio" aria-checked={mode === 'valve'} onClick={() => (audio.play('tap'), setMode('valve'))}>
            🔧 Ventil
          </button>
          {game.camera > 0 || props.params.camera || props.research.termokamera ? (
            <button class="btn ps-tool cam" onClick={camera} disabled={game.camera <= 0} aria-label={`Termokamera, še ${game.camera}`}>
              📷 {game.camera}
            </button>
          ) : null}
        </div>
        <p class="ps-status">{mode === 'inspect' ? 'Številka pove, koliko od 8 sosednjih odsekov pušča.' : 'Tapni odsek, za katerega veš, da pušča. Dolg pritisk vedno zapre ventil.'}</p>
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
