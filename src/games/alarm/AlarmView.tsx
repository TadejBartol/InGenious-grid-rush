import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AlarmParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import {
  ACTION_INFO,
  AlarmSim,
  CAUSE_INFO,
  DOSES,
  HIST_LEN,
  LIMIT_MAX,
  LIMIT_MIN,
  LOW_ALARM,
  RESPOND_SLOWMO,
  SAFE_MAX,
  SAFE_MIN,
  SITE_NAMES,
  type AlarmAction,
  type Unit,
} from './logic';

/** Chart range in °C. */
const T_LO = -1;
const T_HI = 12;
const ty = (v: number, h: number) => h - ((Math.max(T_LO, Math.min(T_HI, v)) - T_LO) / (T_HI - T_LO)) * h;

const ICON: Record<string, string> = {
  door: 'M7 3h10v18H7z M14 12h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  move: 'M4 12h13 M13 7l5 5-5 5 M4 5v14',
  dial: 'M12 4a8 8 0 1 0 .01 0 M12 12l4-3',
  ice: 'M12 2v20 M4 7l16 10 M20 7 4 17',
  sensor: 'M5 12a7 7 0 0 1 14 0 M8.5 12a3.5 3.5 0 0 1 7 0 M12 12v8',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 .01 0',
};

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Night clock: the round runs from 22:00 to 06:00. */
const clock = (frac: number) => {
  const h = (22 + frac * 8) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
};

export function AlarmView(props: GameProps<AlarmParams>) {
  const spoilBonus = (props.research.pragovi ?? 0) * 1.5;
  const sim = useMemo(() => new AlarmSim(props.params, { spoilBonus }), []);
  expose('alarm', sim);
  const [, setFrame] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [pulse, setPulse] = useState<Record<number, 'good' | 'bad'>>({});
  const [flash, setFlash] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const openRef = useRef<number | null>(null);
  openRef.current = open;
  const doneRef = useRef(false);

  const say = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() + Math.random() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);
  const mark = (id: number, kind: 'good' | 'bad') => {
    setPulse((p) => ({ ...p, [id]: kind }));
    setTimeout(() => setPulse((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    }), 900);
  };

  useEffect(
    () =>
      sim.on((e) => {
        switch (e.type) {
          case 'alarm':
            audio.play('alarm');
            buzz([60, 40, 60]);
            break;
          case 'excursion':
            say(`${e.unit.name}: izven ${SAFE_MIN}–${SAFE_MAX} °C!`, 'bad');
            break;
          case 'lost':
            audio.play('fail');
            buzz([120, 60, 120]);
            setFlash((f) => f + 1);
            shake();
            say(`${e.unit.name}: ${DOSES} odmerkov uničenih.`, 'bad');
            if (openRef.current === e.unit.id) setOpen(null);
            break;
          case 'fixed':
            audio.play('powerup');
            buzz(30);
            mark(e.unit.id, 'good');
            say(`${CAUSE_INFO[e.incident.cause].name}: rešeno v ${e.response.toFixed(1)} s`, 'good');
            break;
          case 'dismissed':
            audio.play('found');
            mark(e.unit.id, 'good');
            say('Lažni alarm potrjen. Dežurni lahko spi.', 'good');
            break;
          case 'wrong':
            audio.play('wrong');
            buzz([40, 30, 40]);
            mark(e.unit.id, 'bad');
            shake();
            say(e.reason, 'bad');
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
    setOpen(null);
    const completed = sim.passed;
    audio.play(completed ? 'win' : 'fail');
    const avg = Math.round(sim.avgResponse * 10) / 10;
    const lost = sim.lostUnits;
    setTimeout(
      () =>
        props.onDone({
          kind: 'alarm',
          completed,
          mistakes: sim.mistakes,
          timeLeft: 0,
          timeTotal: props.params.durationSec,
          score: sim.dosesSaved,
          metrics: { lost, response: avg, falseAlarms: sim.falseAlarms, fixed: sim.fixed.length },
          failHint: completed ? undefined : lost ? `izgubljenih ${lost} hladilnikov` : 'nekateri incidenti niso bili rešeni',
          notes: [
            `Rešenih incidentov: ${sim.fixed.length}/${sim.incidents.length}, povprečni odziv ${avg.toFixed(1)} s.`,
            `Lažnih alarmov: ${sim.falseAlarms}. Meja alarma ${sim.threshold.toFixed(1)} °C.${sim.falseAlarms > 3 ? ' Prenizka meja zvoni ob vsakem odpiranju vrat.' : ''}`,
            `Rešenih odmerkov: ${sim.dosesSaved}.`,
          ],
          emoji: `🌙${sim.units.map((u) => (u.lost ? '🟥' : '🟩')).join('')} ⏱${avg.toFixed(1)}s${sim.mistakes ? ' ❌'.repeat(Math.min(3, sim.mistakes)) : ' ✨'}`,
        }),
      900,
    );
  };

  // Simulation clock, slowed while the player decides.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && !sim.finished) {
        sim.update(openRef.current !== null ? dt * RESPOND_SLOWMO : dt);
        acc += dt;
        if (acc > 0.1) {
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
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
  };

  const tapUnit = (u: Unit) => {
    if (u.lost || sim.finished || props.paused) return;
    audio.unlock();
    audio.play('tap');
    touched();
    setOpen(u.id);
  };
  const answer = (a: AlarmAction) => {
    if (open === null) return;
    sim.respond(open, a);
    setOpen(null);
    setFrame((f) => f + 1);
  };

  const sites = [...new Set(sim.units.map((u) => u.site))];
  const safe = sim.units.filter((u) => !u.lost).length;
  const anyAlarm = sim.units.some((u) => u.alarm && !u.lost);
  const openUnit = open !== null ? sim.units[open] : null;

  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={sim.timeLeft} onPause={props.onPause}>
        <span class={`pill${safe === sim.units.length ? ' good' : ''}`} aria-label={`Varnih enot ${safe} od ${sim.units.length}`}>
          💉 {safe}/{sim.units.length}
        </span>
      </Hud>
      <div class={`stage alarm-stage${open !== null ? ' slowmo' : ''}${anyAlarm ? ' ringing' : ''}`} ref={stageRef}>
        <div class="night-strip" aria-hidden="true">
          <span class="moon" />
          <span class="mono">{clock(sim.t / props.params.durationSec)}</span>
          <i style={{ '--p': sim.t / props.params.durationSec }} />
          <span class="mono muted">06:00</span>
        </div>
        <div class="alarm-board">
          {sites.map((s) => {
            const units = sim.units.filter((u) => u.site === s);
            const fridges = units.filter((u) => u.kind === 'fridge');
            const dark = fridges.length > 0 && fridges.every((u) => !u.power);
            return (
              <section class={`alarm-site${dark ? ' dark' : ''}`}>
                <header>
                  <b>{SITE_NAMES[s]}</b>
                  <span class={`site-power${dark ? ' off' : ''}`}>
                    <Glyph d={ICON.bolt} />
                    {dark ? 'BREZ ELEKTRIKE' : 'omrežje'}
                  </span>
                </header>
                <div class="alarm-units">
                  {units.map((u) => (
                    <UnitCard u={u} sim={sim} pulse={pulse[u.id]} onTap={() => tapUnit(u)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        {flash > 0 && <div class="flash-red" key={flash} />}
        {toast && open === null && (
          <div class={`toast-line ${toast.kind}`} key={toast.id} role="status">
            {toast.text}
          </div>
        )}
        {openUnit && (
          <div class="diag alarm-sheet" role="dialog" aria-label={`Ukrep: ${openUnit.name}`}>
            <div class="diag-head">
              <b>
                {openUnit.name} · {SITE_NAMES[openUnit.site]}
              </b>
              <button class="sheet-x" onClick={() => setOpen(null)} aria-label="Zapri">
                ✕
              </button>
            </div>
            <div class="alarm-facts">
              <span class={openUnit.door ? 'bad' : ''}>
                <Glyph d={ICON.door} />
                {openUnit.kind === 'bag' ? 'v avtu' : openUnit.door ? 'vrata odprta' : 'vrata zaprta'}
              </span>
              <span class={openUnit.kind === 'fridge' && !openUnit.power ? 'bad' : ''}>
                <Glyph d={ICON.bolt} />
                {openUnit.kind === 'bag' ? `vložki ${Math.round(openUnit.packs * 100)} %` : openUnit.power ? 'napajanje OK' : 'brez napajanja'}
              </span>
              <span class={trend(openUnit) !== 0 ? 'bad' : ''}>
                {trend(openUnit) > 0 ? '↗ raste' : trend(openUnit) < 0 ? '↘ pada' : '→ stabilno'}
              </span>
            </div>
            <div class="alarm-opts">
              {sim.options(openUnit.id).map((a) => (
                <button class="alarm-opt" data-action={a} onClick={() => answer(a)}>
                  <Glyph d={ICON[ACTION_INFO[a].icon]} />
                  <b>{ACTION_INFO[a].label}</b>
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
      <div class="alarm-limit">
        <label class="slider">
          <span class="slider-head">
            <b>Meja alarma</b>
            <span class="mono">{sim.threshold.toFixed(1)} °C</span>
          </span>
          <input
            type="range"
            min={LIMIT_MIN * 10}
            max={LIMIT_MAX * 10}
            step={5}
            value={sim.threshold * 10}
            aria-label="Meja alarma v stopinjah"
            onInput={(e) => {
              sim.setThreshold(Number((e.target as HTMLInputElement).value) / 10);
              audio.play('tick');
              touched();
              setFrame((f) => f + 1);
            }}
          />
          <span class="slider-scale">
            <span>zgodaj, več lažnih</span>
            <span>pozno, malo časa</span>
          </span>
        </label>
      </div>
    </>
  );
}

/** Slope of the last two seconds of readings: +1 rising, -1 falling, 0 steady. */
function trend(u: Unit) {
  const h = u.history;
  const d = h[h.length - 1] - h[h.length - 9];
  return d > 0.35 ? 1 : d < -0.35 ? -1 : 0;
}

function UnitCard({ u, sim, pulse, onTap }: { u: Unit; sim: AlarmSim; pulse?: 'good' | 'bad'; onTap: () => void }) {
  const W = 120;
  const H = 46;
  const step = W / (HIST_LEN - 1);
  const line = u.history.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${ty(v, H).toFixed(1)}`).join(' ');
  const out = u.temp > SAFE_MAX || u.temp < SAFE_MIN;
  const state = u.lost ? 'lost' : out ? 'out' : u.alarm ? 'alarm' : 'ok';
  const tr = trend(u);
  const spoil = out ? Math.min(1, u.excursion / sim.spoilSec) : 0;
  return (
    <button
      class={`unit-card ${state}${pulse ? ` pulse-${pulse}` : ''}${u.kind === 'bag' ? ' bag' : ''}`}
      onClick={onTap}
      disabled={u.lost}
      aria-label={`${u.name}, ${u.reading.toFixed(1)} stopinj${u.alarm ? ', alarm' : ''}${u.lost ? ', uničeno' : ''}`}
    >
      <span class="unit-top">
        <b>{u.name}</b>
        {u.kind === 'fridge' ? (
          <span class={`unit-door${u.door ? ' open' : ''}`} title="vratni kontakt">
            <Glyph d={ICON.door} />
          </span>
        ) : (
          <span class="unit-packs" title="hladilni vložki">
            <i style={{ '--p': u.packs }} />
          </span>
        )}
        {u.kind === 'fridge' && !u.power && (
          <span class="unit-nopower">
            <Glyph d={ICON.bolt} />
          </span>
        )}
      </span>
      <span class="unit-read">
        <b class="mono">{u.lost ? '✕' : u.reading.toFixed(1)}</b>
        <small>{u.lost ? 'uničeno' : `°C ${tr > 0 ? '↗' : tr < 0 ? '↘' : ''}`}</small>
        {u.alarm && !u.lost && <span class="unit-bell" aria-hidden="true">🔔</span>}
      </span>
      <svg class="unit-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y={ty(SAFE_MAX, H)} width={W} height={ty(SAFE_MIN, H) - ty(SAFE_MAX, H)} class="band" />
        <line x1="0" x2={W} y1={ty(sim.threshold, H)} y2={ty(sim.threshold, H)} class="limit" />
        <line x1="0" x2={W} y1={ty(LOW_ALARM, H)} y2={ty(LOW_ALARM, H)} class="limit low" />
        <path d={line} class="trace" />
      </svg>
      {out && !u.lost && (
        <span class="unit-spoil" style={{ '--p': spoil }}>
          izven območja
        </span>
      )}
    </button>
  );
}
