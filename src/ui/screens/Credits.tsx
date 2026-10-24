import { useEffect, useState } from "preact/hooks";
import { audio } from "../../audio/sfx";
import { isFacilityLit } from "../../core/balance";
import { fmt } from "../../core/format";
import { FACILITIES, LEVELS, REGIONS } from "../../core/levels";
import { useGame } from "../../state/store";
import { nav } from "../nav";
import { DarkMeter } from "../components/DarkMeter";
import { Genko } from "../components/Genko";
import { IsoFactory } from "../components/IsoFactory";

/** How long the roll takes; the stinger plays after it. */
const ROLL_MS = 46000;

/**
 * End credits after the epilogue: the whole lit city, what the player achieved,
 * the cast and the crew, then a short stinger in the dark.
 */
export function Credits() {
  const levels = useGame((s) => s.levels);
  const lifetime = useGame((s) => s.lifetimeKwh);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const [stinger, setStinger] = useState(false);
  const campaign = LEVELS.filter((l) => !l.id.startsWith("daily-"));
  const cleared = campaign.filter((l) => (levels[l.id]?.stars ?? 0) > 0).length;
  const stars = campaign.reduce((s, l) => s + (levels[l.id]?.stars ?? 0), 0);
  const lit = FACILITIES.filter((f) => isFacilityLit(f, levels)).length;

  useEffect(() => {
    audio.play("win");
    const t = window.setTimeout(() => setStinger(true), reduced ? 0 : ROLL_MS);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    audio.play("tap");
    nav.setState({ credits: false });
    nav.getState().go({ name: "tabs", tab: "map" });
  };

  return (
    <div
      class={`credits${stinger ? " end" : ""}`}
      role="dialog"
      aria-label="Odjavna špica"
    >
      <div class="credits-city" aria-hidden="true">
        {REGIONS.map((r) => FACILITIES.filter((f) => f.region === r.id).at(-1)!)
          .filter(Boolean)
          .map((f, i) => (
            <div class="cc-fac" style={{ "--i": i }}>
              <IsoFactory art={f.art} lit />
            </div>
          ))}
      </div>
      {!stinger && (
        <div class="credits-view">
          <div
            class="credits-roll"
            style={{ animationDuration: `${ROLL_MS}ms` }}
          >
            <div class="cr-logo">
              <small>InGenious</small>
              <strong>Grid Rush</strong>
            </div>
            <p class="cr-quote">Kar je izmerjeno, ni pozabljeno.</p>

            <section>
              <h3>Tvoje mesto</h3>
              <dl class="cr-stats">
                <dt>Prihranjeno skupaj</dt>
                <dd class="mono">{fmt(lifetime)} kWh</dd>
                <dt>Opravljene stopnje</dt>
                <dd class="mono">
                  {cleared}/{campaign.length}
                </dd>
                <dt>Zvezdice</dt>
                <dd class="mono">
                  {stars}/{campaign.length * 3}
                </dd>
                <dt>Osvetljeni objekti</dt>
                <dd class="mono">
                  {lit}/{FACILITIES.length}
                </dd>
              </dl>
            </section>

            <section>
              <h3>Igrajo</h3>
              <div class="cr-cast">
                <Genko size={64} mood="happy" />
                <p>
                  <b>InGenious</b>
                  <span>robotek, ki bere vse</span>
                </p>
              </div>
              <div class="cr-cast">
                <DarkMeter size={64} mood="healed" />
                <p>
                  <b>Š-0</b>
                  <span>prvi merilnik starega omrežja, 1987</span>
                </p>
              </div>
              <div class="cr-cast">
                <span class="cr-you" aria-hidden="true">
                  ★
                </span>
                <p>
                  <b>Partner</b>
                  <span>ti</span>
                </p>
              </div>
            </section>

            <section>
              <h3>Poglavja</h3>
              <ol class="cr-chapters">
                {REGIONS.map((r) => (
                  <li>
                    <span class="mono">{r.id}</span> {r.name}
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h3>Ustvarili</h3>
              <dl class="cr-crew">
                <dt>Idejna zasnova in produkcija</dt>
                <dd>Tadej Bartol</dd>
                <dt>Zasnova igre, zgodba, režija, programiranje</dt>
                <dd>Claude · Anthropic</dd>
                <dt>Glasovi</dt>
                <dd>Azure nevronski glasovi</dd>
                <dt>Glasba in zvočni učinki</dt>
                <dd>sintetizirano v živo, Web Audio</dd>
                <dt>Tehnologija</dt>
                <dd>PixiJS · Preact · Vite</dd>
              </dl>
            </section>

            <section>
              <h3>Posebna zahvala</h3>
              <p class="cr-thanks">
                Vsem energetskim managerjem, ki ponoči gledajo grafe, ko vsi
                drugi spijo.
              </p>
            </section>

            <p class="cr-quote big">Hvala, ker si igral.</p>
          </div>
        </div>
      )}
      {stinger && (
        <div class="credits-stinger">
          <i class="cs-blink" aria-hidden="true" />
          <p>Na podeželju, v kleti stare zadruge, utripne rdeča lučka.</p>
          <p>Števca Š-1 ni še nihče prebral.</p>
          <button class="btn green big" onClick={close}>
            Nazaj na zemljevid
          </button>
        </div>
      )}
      {!stinger && (
        <button class="btn credits-skip" onClick={() => setStinger(true)}>
          Preskoči
        </button>
      )}
    </div>
  );
}
