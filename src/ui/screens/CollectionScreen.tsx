import { LEVELS } from '../../core/levels';
import { plural, SKINS } from '../../core/balance';
import { audio } from '../../audio/sfx';
import { store, useGame } from '../../state/store';
import { Genko } from '../components/Genko';
import { Cost } from '../components/Common';
import { SCENES, sceneKey } from '../../core/story';
import { playScene } from '../story';
import { IconLock, IconPlay } from '../components/Icons';

export function CollectionScreen() {
  const cards = useGame((s) => s.cards);
  const owned = useGame((s) => s.skinsOwned);
  const skin = useGame((s) => s.skin);
  const chips = useGame((s) => s.chips);
  const seen = useGame((s) => s.seenTips);
  return (
    <>
      <div class="section-title">Zgodba · skrivnost Š-0</div>
      <div class="chronicle">
        {SCENES.map((sc, i) => {
          const open = seen.includes(sceneKey(sc.id));
          return (
            <button class={`chap ${sc.tone}${open ? '' : ' locked'}`} disabled={!open} onClick={() => (audio.play('tap'), playScene(sc.id, undefined, true))} aria-label={open ? `Ponovno poglej: ${sc.title}` : 'Še zaklenjen prizor'}>
              <span class="chap-n mono">{String(i + 1).padStart(2, '0')}</span>
              <span class="grow">{open ? sc.title : '???'}</span>
              {open ? <IconPlay width={16} height={16} /> : <IconLock width={14} height={14} />}
            </button>
          );
        })}
      </div>
      <div class="section-title">Robotek InGenious · kozmetika za čipe</div>
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
        Imaš {chips} InGenious {plural(chips, 'čip', 'čipa', 'čipe', 'čipov')}. Dobiš jih za 3 zvezdice, bossa in dnevni niz.
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
