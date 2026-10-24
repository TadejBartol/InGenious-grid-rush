import { LEVELS } from '../../core/levels';
import { plural, SKINS } from '../../core/balance';
import { audio } from '../../audio/sfx';
import { store, useGame } from '../../state/store';
import { Genko } from '../components/Genko';
import { Cost } from '../components/Common';

export function CollectionScreen() {
  const cards = useGame((s) => s.cards);
  const owned = useGame((s) => s.skinsOwned);
  const skin = useGame((s) => s.skin);
  const chips = useGame((s) => s.chips);
  return (
    <>
      <div class="section-title">Genko · kozmetika za čipe</div>
      <div class="skins">
        {SKINS.map((sk) => {
          const has = owned.includes(sk.id);
          return (
            <button
              class={`skin${skin === sk.id ? ' equipped' : ''}`}
              onClick={() => {
                if (has) store.getState().equipSkin(sk.id);
                else if (!sk.unlock && store.getState().buySkin(sk.id)) audio.play('unlock');
                else return audio.play('blocked');
                audio.play('tap');
              }}
              aria-label={`${sk.name}${has ? '' : ', zaklenjen'}`}
            >
              <Genko size={52} skin={sk.id} mood={has ? 'happy' : 'smug'} />
              <span>{sk.name}</span>
              <span class="tiny">
                {skin === sk.id ? 'Izbran' : has ? 'Izberi' : sk.unlock ? 'Vse stopnje regije 1 s 3★' : <Cost kind="chips" n={sk.cost} />}
              </span>
            </button>
          );
        })}
      </div>
      <p class="tiny muted" style={{ margin: '8px 2px 0' }}>
        Imaš {chips} Genko {plural(chips, 'čip', 'čipa', 'čipe', 'čipov')}. Dobiš jih za 3 zvezdice, bossa in dnevni niz.
      </p>

      <div class="section-title">
        Kartice naprav · {cards.length}/{LEVELS.length}
      </div>
      <div class="cards">
        {LEVELS.map((l) =>
          cards.includes(l.card.id) ? (
            <div class={`dcard ${l.card.rarity}`}>
              <span class="rarity">{l.card.rarity}</span>
              <b>{l.card.name}</b>
              {l.card.text}
            </div>
          ) : (
            <div class="dcard locked">
              <div>
                <div style={{ fontSize: '28px' }}>?</div>
                <span class="tiny">Stopnja {l.region}-{l.index}</span>
              </div>
            </div>
          ),
        )}
      </div>
    </>
  );
}
