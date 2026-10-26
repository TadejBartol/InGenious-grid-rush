import { createContext } from 'preact';
import type { GameKind, LevelDef } from '../../core/types';
import { goalLabel } from '../../core/balance';
import { Sheet } from './Common';
import { IconPlay } from './Icons';

/** Opens the rules sheet; provided by the play screen, used by the HUD's info button. */
export const HelpContext = createContext<(() => void) | null>(null);

interface Help {
  goal: string;
  how: string[];
  watch: string[];
}

export const HELP: Record<GameKind, Help> = {
  priklop: {
    goal: 'Vsak merilnik poveži s kablom do vtičnice iste barve na prehodu.',
    how: [
      'Povleci prst od merilnika (M1, M2 …) do okrogle vtičnice iste barve.',
      'Kabli se ne smejo križati in morajo skupaj zapolniti vsa polja.',
      'Tapni merilnik v vrstici spodaj, da mu nastaviš Modbus naslov.',
    ],
    watch: ['Dva merilnika z istim naslovom se kregata: enemu izberi prost naslov, najbolje pred priklopom.', 'Če kabel pade, ga znova povleci.', 'Najprej speljaj kable, ki imajo le eno možno pot.'],
  },
  konica: {
    goal: 'Drži skupno moč pod rdečo črto do konca časa.',
    how: ['Tapni porabnika, da ga izklopiš ali spet vklopiš.', 'Modra krivulja je skupna moč, rdeča črta je dovoljena konica.'],
    watch: [
      'Izklopljenemu porabniku se prazni zaloga (tlak, temperatura …). Pred praznim ga vklopi nazaj.',
      'Ob vklopu porabnik za trenutek potegne več. Ne vklapljaj vsega hkrati.',
      'Proizvodnih linij in kritičnih naprav ne moreš izklopiti.',
    ],
  },
  detektiv: {
    goal: 'Najdi vse anomalije v porabi in povej, kaj jih je povzročilo.',
    how: ['Ko modra črta uide iz svetlega pasu, tapni nanjo.', 'Čas se upočasni: izberi vzrok anomalije.'],
    watch: ['Kar je na urniku zgoraj, je načrtovano. Tega ne prijavi.', 'Prej ko opaziš, več DP dobiš.', 'Napačen vzrok ali lažna prijava šteje kot napaka.'],
  },
  wmbus: {
    goal: 'Z radijskim signalom pokrij vse vodomere in števce toplote.',
    how: ['Spodaj izberi prehod ali repetitor, nato tapni prosto polje.', 'Drži prst na polju, da vidiš krog dosega, in spusti, ko pokriva prave merilnike.'],
    watch: ['Repetitor deluje le, če je v dosegu prehoda ali drugega repetitorja.', 'Na stavbe naprav ne moreš postaviti.', 'Za tretjo zvezdico porabi čim manj naprav.'],
  },
  urnik: {
    goal: 'Sestavi vozni red motorja za ves dan: mesto naj ima toplo, dobiček naj doseže cilj.',
    how: [
      'Tapni blok v vrstici Motor, da tam teče. Povleci prst čez več blokov naenkrat.',
      'Rumena številka je zaslužek, če motor teče v tem bloku. Negativna pomeni izgubo.',
      'Motor da toploto v hranilnik, mesto jo vsak blok porabi (vrstica Odjem).',
      'Ko je urnik veljaven, pritisni Zaženi dan.',
    ],
    watch: [
      'Hranilnik ne sme biti prazen (❄ mrzli radiatorji) ne prepoln (! toplota gre v nič).',
      'Toploto za poceni ure pripravi vnaprej, ko je elektrika draga.',
      'Če je navedeno, vsak zagon motorja stane obrabo, hranilnik pa mora zvečer ostati poln za jutri.',
      'Najboljši možni dobiček je napisan zgoraj. Če ga dosežeš, dobiš zvezdico.',
    ],
  },
  alarm: {
    goal: 'Obvaruj cepiva: ko hladilnik zazvoni, izberi pravi ukrep.',
    how: ['Ko zazvoni alarm, tapni hladilnik.', 'Poglej ikone (vrata, napajanje) in smer krivulje, nato izberi ukrep.'],
    watch: [
      'Vsak alarm ni pravi: lažni senzor pokaže skok brez razloga.',
      'Mejo alarma lahko premakneš. Prenizka zvoni ob vsakem odpiranju vrat, previsoka te opozori prepozno.',
      'Kurirske torbe potrebujejo sveže hladilne vložke, ko se temperatura dvigne.',
    ],
  },
  selitev: {
    goal: 'Prenesi stare zapise Š-0 na prave nove merilnike, brez napak.',
    how: ['Poglej kodo zapisa in jo poišči v tabeli zgoraj.', 'Tapni pravi merilnik spodaj, da zapis pošlješ tja.'],
    watch: [
      'Rumen Wh je 1000× preveč: najprej pritisni »Wh → kWh«.',
      '##### in negativne vrednosti vrzi v koš.',
      'Če je mesec pri merilniku že zelen, je zapis dvojnik: tudi v koš.',
      'Zapis ne čaka večno, pazi na trak pod njim.',
    ],
  },
};

export function GameHelpSheet({ kind, kindName, level, tip, onClose }: { kind: GameKind; kindName: string; level: LevelDef; tip?: string; onClose: () => void }) {
  const h = HELP[kind];
  return (
    <Sheet label={`Navodila: ${kindName}`} onClose={onClose}>
      <h2 style={{ marginBottom: '4px' }}>{kindName}</h2>
      <p class="help-goal">{h.goal}</p>
      <div class="section-title">Kako igraš</div>
      <ol class="help-list">
        {h.how.map((t) => (
          <li>{t}</li>
        ))}
      </ol>
      <div class="section-title">Pazi</div>
      <ul class="help-list">
        {h.watch.map((t) => (
          <li>{t}</li>
        ))}
      </ul>
      {tip && <p class="help-tip">💡 {tip}</p>}
      <div class="section-title">Zvezdice te stopnje</div>
      <ul class="help-stars">
        {level.stars.map((g) => (
          <li>★ {goalLabel(g)}</li>
        ))}
      </ul>
      <button class="btn primary big" style={{ width: '100%' }} onClick={onClose}>
        <IconPlay width={18} /> Nadaljuj
      </button>
    </Sheet>
  );
}
