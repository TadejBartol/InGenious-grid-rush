import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SelitevParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { MONTHS, SelitevGame, shownValue, VERDICT_TEXT, type SelitevVerdict } from './logic';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

type Fly = { id: number; to: number | 'bin'; good: boolean; label: string };

export function SelitevView(props: GameProps<SelitevParams>) {
  const game = useMemo(() => new SelitevGame(props.params), []);
  expose('selitev', game);
  const validation = (props.research.validacija ?? 0) > 0;
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [hit, setHit] = useState<{ lane: number | 'bin'; good: boolean; id: number } | null>(null);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const doneRef = useRef(false);

  const say = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() + Math.random() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const judge = (verdict: SelitevVerdict, combo: number) => {
    if (verdict === 'ok' || verdict === 'cleaned') {
      audio.play(combo >= 5 && combo % 5 === 0 ? 'coin' : 'connect');
      if (combo >= 5 && combo % 5 === 0) say(`Niz ×${combo}! +5 DP`, 'good');
    } else {
      audio.play('wrong');
      buzz([40, 30, 40]);
      shake();
      say(VERDICT_TEXT[verdict], 'bad');
    }
  };

  useEffect(
    () =>
      game.on((e) => {
        switch (e.type) {
          case 'converted':
            audio.play('step');
            break;
          case 'routed':
            judge(e.verdict, e.combo);
            setHit({ lane: e.target, good: e.verdict === 'ok', id: Date.now() });
            break;
          case 'binned':
            judge(e.verdict, e.combo);
            setHit({ lane: 'bin', good: e.verdict === 'cleaned', id: Date.now() });
            break;
          case 'timeout':
            judge(e.verdict, 0);
            setFly({ id: Date.now(), to: 'bin', good: false, label: game.targets[e.record.target]?.code ?? '' });
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
    const pct = Math.round(game.integrity * 100);
    const completed = game.passed;
    audio.play(completed ? 'win' : 'fail');
    setTimeout(
      () =>
        props.onDone({
          kind: 'selitev',
          completed,
          mistakes: game.mistakes,
          timeLeft: 0,
          timeTotal: Math.round(game.elapsed),
          score: game.correct * 10 + game.cleaned * 5,
          metrics: { integrity: pct, lost: game.lost, cleaned: game.cleaned, combo: game.bestCombo, bonusDp: Math.floor(game.bestCombo / 5) * 5 },
          failHint: completed ? undefined : `celovitost ${pct} %, potrebno ${Math.round(props.params.pass * 100)} %`,
          notes: [
            `Prenesenih zapisov: ${game.correct}/${game.valid} (${pct} % celovitost).`,
            `Očiščenih slabih zapisov: ${game.cleaned}. ${game.lost ? `Lukenj v zgodovini: ${game.lost}.` : 'Brez lukenj v zgodovini.'}`,
            `Najdaljši niz: ${game.bestCombo}.`,
          ],
          emoji: `🗄️${game.targets.map((t) => (t.slots.filter(Boolean).length >= 6 ? '🟩' : '🟨')).join('')} ${pct}%${game.mistakes ? ' ❌'.repeat(Math.min(3, game.mistakes)) : ' ✨'}`,
        }),
      900,
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
        if (acc > 0.05) {
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
  const r = game.current;
  const route = (k: number) => {
    if (!r || props.paused) return;
    touched();
    setFly({ id: Date.now(), to: k, good: true, label: game.targets[r.target].code });
    game.route(k);
    setFrame((f) => f + 1);
  };
  const bin = () => {
    if (!r || props.paused) return;
    touched();
    setFly({ id: Date.now(), to: 'bin', good: true, label: '' });
    game.bin();
    setFrame((f) => f + 1);
  };
  const convert = () => {
    if (!r || props.paused) return;
    touched();
    game.convert();
    setFrame((f) => f + 1);
  };

  const left = r ? 1 - game.wait / game.cardSec : 0;
  const t = r ? game.targets[r.target] : null;
  const unit = r ? (r.unit === 'Wh' && !game.converted ? 'Wh' : 'kWh') : '';
  const warn = validation && r && game.bad(r);
  const queue = game.records.slice(game.index + 1, game.index + 4);
  // Accuracy so far: good records that arrived intact out of the good ones already handled.
  const handled = game.records.slice(0, game.index).filter((x) => !x.flaw).length;
  const running = handled ? game.correct / handled : 1;

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={null} onPause={props.onPause}>
        <span class="pill" aria-label={`Zapis ${Math.min(game.index + 1, game.records.length)} od ${game.records.length}`}>
          🗄️ {Math.min(game.index + 1, game.records.length)}/{game.records.length}
        </span>
        <span class={`pill${running >= props.params.pass ? ' good' : ''}`} aria-label="Celovitost do zdaj">
          ✓ {Math.round(running * 100)} %
        </span>
      </Hud>
      <div class="stage selitev-stage" ref={stageRef}>
        <div class="sel-map" aria-label="Tabela kod">
          <span class="sel-map-head">STARA KODA → NOV MERILNIK</span>
          <div class="sel-map-rows">
            {game.targets.map((x) => (
              <span style={{ '--c': hex(x.color) }}>
                <b class="mono">{x.code}</b>
                <i>→</i>
                {x.name}
              </span>
            ))}
          </div>
        </div>

        <div class="sel-terminal">
          <div class="sel-queue" aria-hidden="true">
            {queue.map((q, k) => (
              <span class="sel-ghost" style={{ '--k': k, '--c': hex(game.targets[q.target]?.color ?? 0x888888) }}>
                {game.targets[q.target]?.code}
              </span>
            ))}
          </div>
          {r && t && (
            <div class={`sel-card${warn ? ' warn' : ''}${r.flaw ? ' flaw' : ''}`} key={r.id} style={{ '--c': hex(t.color) }}>
              <div class="sel-card-row">
                <span class="mono sel-code">
                  <i class="sel-dot" aria-hidden="true" />
                  {t.code}
                </span>
                <span class="mono sel-date">
                  {MONTHS[r.month]} {r.year}
                </span>
              </div>
              <div class={`sel-value mono${game.converted ? ' converted' : ''}`} key={`${r.id}-${game.converted}`}>
                {shownValue(r, game.converted)} <small class={unit === 'Wh' ? 'wh' : ''}>{unit}</small>
              </div>
              {warn && <span class="sel-warn">⚠ preveri zapis</span>}
              <span class="sel-timer" style={{ '--p': Math.max(0, left) }} />
            </div>
          )}
          {fly && <span class={`sel-fly to-${fly.to}`} key={fly.id} style={{ '--n': game.targets.length, '--i': fly.to === 'bin' ? 0 : fly.to }} aria-hidden="true" />}
          <div class="sel-scan" aria-hidden="true" />
        </div>

        <div class="sel-tools">
          <button class={`btn sel-convert${game.converted ? ' on' : ''}`} onClick={convert} disabled={!r || game.converted} aria-label="Pretvori Wh v kWh">
            Wh → kWh <small>÷ 1000</small>
          </button>
          <button
            class={`btn sel-bin${hit?.lane === 'bin' ? (hit.good ? ' hit-good' : ' hit-bad') : ''}`}
            key={hit?.lane === 'bin' ? hit.id : 'bin'}
            onClick={bin}
            disabled={!r}
            aria-label="Zavrzi zapis"
          >
            🗑 Zavrzi
          </button>
        </div>

        <div class="sel-lanes" style={{ '--n': game.targets.length }}>
          {game.targets.map((x, k) => (
            <button
              class={`sel-lane${hit?.lane === k ? (hit.good ? ' hit-good' : ' hit-bad') : ''}`}
              key={hit?.lane === k ? `${k}-${hit.id}` : k}
              style={{ '--c': hex(x.color) }}
              onClick={() => route(k)}
              disabled={!r}
              aria-label={`Prenesi na ${x.name}`}
            >
              <b>{x.name}</b>
              <span class="mono">{x.code}</span>
              <span class="sel-slots" aria-hidden="true">
                {x.slots.map((s, m) => (
                  <i class={s ? 'on' : ''} title={MONTHS[m]} />
                ))}
              </span>
              <small class="mono">{x.year}</small>
            </button>
          ))}
        </div>

        {game.combo >= 3 && (
          <div class="toast-line good sel-combo" aria-hidden="true">
            Niz ×{game.combo}
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
    </>
  );
}
