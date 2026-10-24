import { fmt } from '../../core/format';
import { idleRate } from '../../core/balance';
import { useGame } from '../../state/store';
import { Sheet } from './Common';
import { GenkoSays } from './Genko';
import { IconBolt, IconChip, IconData, IconFlame } from './Icons';

export type Currency = 'kwh' | 'dp' | 'chips' | 'streak';

const INFO: Record<Currency, { name: string; color: string; icon: typeof IconBolt; what: string; earn: string[]; spend: string[]; quip: string }> = {
  kwh: {
    name: 'Prihranjene kWh',
    color: 'var(--green)',
    icon: IconBolt,
    what: 'Energija, ki je Temni števec ni pojedel. Vsaka kWh na števcu je resničen prihranek tvojih objektov.',
    earn: ['Za vsako odigrano stopnjo (več zvezdic = več kWh)', 'Osvetljeni objekti polnijo števec sami, tudi ko igra ni odprta', 'Ponovno igranje stopnje prinese 35 % nagrade'],
    spend: ['Nadgradnje objektov, ki povečajo prihranek na uro'],
    quip: 'Najlepša kWh je tista, ki je ni bilo treba porabiti.',
  },
  dp: {
    name: 'Podatkovne točke (DP)',
    color: 'var(--dp)',
    icon: IconData,
    what: 'Znanje, ki ga zbereš iz meritev. Z njim odklepaš funkcije platforme InGenious.',
    earn: ['Vsaka stopnja, tudi neuspešna (malo, a nekaj)', 'Combo pri Detektivu podvoji DP', 'Prvo igranje stopnje prinese največ'],
    spend: ['Raziskave v laboratoriju: več časa, napovedi, AI analiza, daljši pomnilnik'],
    quip: 'Podatki brez analize so samo zelo drag šum.',
  },
  chips: {
    name: 'InGenious čipi',
    color: 'var(--chip)',
    icon: IconChip,
    what: 'Redka valuta za velike korake: nove regije in nove preobleke zame.',
    earn: ['Prve 3 zvezdice na stopnji: 1 čip', 'Premagan boss regije: 3 čipi', 'Dnevni izziv: 1 čip, vsak 7. dan zapored še 2 zraven'],
    spend: ['Odklep novih regij na zemljevidu', 'Preobleke za robotka v Zbirki'],
    quip: 'Čipe zbiraj pametno. Jaz bi jih zapravil za neon preobleko, ampak to sem jaz.',
  },
  streak: {
    name: 'Niz dni',
    color: 'var(--orange)',
    icon: IconFlame,
    what: 'Koliko dni zapored si rešil dnevni izziv.',
    earn: ['Reši dnevni izziv vsak dan', 'En zamrznjen dan na teden ti niza ne prekine'],
    spend: ['Vsak 7. dan zapored prinese 2 dodatna čipa'],
    quip: 'Energetski menedžerji ne poznajo vikendov. Ti jih lahko.',
  },
};

export function CurrencyInfo({ kind, onClose }: { kind: Currency; onClose: () => void }) {
  const info = INFO[kind];
  const amount = useGame((s) => (kind === 'kwh' ? Math.floor(s.kwh) : kind === 'dp' ? Math.floor(s.dp) : kind === 'chips' ? s.chips : s.streak.streak));
  const rate = useGame((s) => idleRate(s.levels, s.upgrades, s.research));
  const Icon = info.icon;
  return (
    <Sheet center onClose={onClose} label={info.name}>
      <div class="cur-info" style={{ '--cur': info.color }}>
        <div class="cur-badge">
          <Icon width={40} height={40} />
        </div>
        <h2>{info.name}</h2>
        <div class="cur-amount mono">
          {fmt(amount)}
          {kind === 'kwh' && rate > 0 && <small> · +{fmt(rate)}/h</small>}
        </div>
        <p class="small">{info.what}</p>
        <div class="cur-cols">
          <div>
            <b>Kako dobiš</b>
            <ul>
              {info.earn.map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          </div>
          <div>
            <b>Za kaj porabiš</b>
            <ul>
              {info.spend.map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          </div>
        </div>
        <GenkoSays text={info.quip} size={44} />
        <button class="btn primary big" onClick={onClose}>
          Razumem
        </button>
      </div>
    </Sheet>
  );
}
