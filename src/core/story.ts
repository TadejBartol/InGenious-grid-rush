/**
 * The story: who is the Dark Meter? Every region peels off one layer of the
 * mystery of "Š-0", the first meter of the old grid that nobody read again.
 *
 * Arc: what is not measured is forgotten. Š-0 counted alone for 39 years and
 * learned to feed on everything nobody looks at. InGenious does not beat him in
 * the end, it reads him, and a read meter is no longer dark.
 *
 * Lines carry their own direction where it matters (`shot`, `act`); everything
 * else is staged automatically by cinema.ts.
 */
import type { Act, Shot } from './cinema';

export type Speaker = 'genko' | 'dark' | 'narrator';
export type StoryMood = 'happy' | 'smug' | 'worried' | 'wow' | 'smirk' | 'angry' | 'hurt' | 'fleeing' | 'healed';

/** Stage effects fired when a line appears. */
export type StoryFx = 'zap' | 'light' | 'flash';

export interface StoryLine {
  who: Speaker;
  mood?: StoryMood;
  text: string;
  fx?: StoryFx;
  /** Overrides the automatic camera framing (see cinema.ts). */
  shot?: Shot;
  /** Overrides the automatic piece of action. */
  act?: Act;
}

export interface Scene {
  id: string;
  title: string;
  /** Background mood: dark = the villain's turf, dawn = after a victory, lit = a facility comes online. */
  tone: 'dark' | 'boss' | 'dawn' | 'lit';
  /** Facility shown centre stage; it lights up on the first `light` line. */
  facility?: string;
  /** Sky over the set; dark and boss scenes rain unless told otherwise. */
  weather?: 'rain' | 'storm' | 'snow' | 'clear';
  lines: StoryLine[];
}

export const SCENES: Scene[] = [
  // ── Poglavje 1 · Industrijska cona ─────────────────────────────────
  {
    id: 'r1-intro',
    title: 'Poglavje 1 · Tihi stroji',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Leto 2031. Slovenija ima več merilnikov kot kdajkoli. Polovica jih molči.' },
      { who: 'genko', mood: 'worried', text: 'Industrijska cona, tri zjutraj. Slišiš? Kompresorji. Nihče ne dela, oni pa piskajo.' },
      { who: 'dark', mood: 'smirk', text: 'Kar ni izmerjeno, je moje. Tako je bilo vedno.' },
      { who: 'genko', mood: 'worried', text: 'Temni števec. Hrani se z energijo, ki je nihče ne vidi: ponoči, v konicah, v puščajočih ceveh.', act: 'scan' },
      { who: 'dark', mood: 'smirk', text: 'Ti si samo še en robotek z grafom. Videl sem jih sto. Vsi so ugasnili.', act: 'laugh' },
      { who: 'genko', mood: 'smug', text: 'Noben pa ni imel tebe za partnerja. Priklopiva merilnike in osvetliva tovarno.', shot: 'two' },
    ],
  },
  {
    id: 'fac-livarna',
    title: 'Livarna se prižge',
    tone: 'lit',
    facility: 'livarna',
    lines: [
      { who: 'narrator', text: 'Livarna. Indukcijske peči so prvič pod nadzorom. Trije merilniki, en prehod, nič več ugibanja.' },
      { who: 'genko', mood: 'wow', text: 'Poglej graf! Peč vleče 160 kW, ko tali, in skoraj nič, ko čaka. Zdaj to končno vidimo.', act: 'connect' },
      { who: 'narrator', fx: 'light', text: 'Prva luč v Industrijski coni se prižge.' },
      { who: 'dark', mood: 'smirk', text: 'Ena luč. Ena sama. Jaz sem jih ugasnil na tisoče.' },
      { who: 'genko', mood: 'smug', text: 'Potem imam še veliko dela. Naslednja je Peskalnica.' },
    ],
  },
  {
    id: 'fac-peskanje',
    title: 'Peskalnica se prižge',
    tone: 'lit',
    facility: 'peskanje',
    lines: [
      { who: 'narrator', text: 'Peskalnica. Odpraševanje teče ves vikend, čeprav v hali ni nikogar.' },
      { who: 'genko', mood: 'worried', text: 'Ventilatorji po 40 kW pihajo v prazno halo. Ob nedeljah. Že leta.', act: 'scan', shot: 'facility' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Urnik vklopa in podštevec. Peskalnica je osvetljena!' },
      { who: 'dark', mood: 'angry', text: 'Moji ventilatorji! Kompresorji ti tega ne bodo odpustili.' },
      { who: 'narrator', text: 'Na podštevcu je star plombirni žig. Komaj berljivo: »Š-«. Ostalo je odrgnjeno.', shot: 'facility', act: 'reveal' },
    ],
  },
  {
    id: 'r1-boss',
    title: 'Boss · Postaja, ki piska ponoči',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Kompresorska postaja. Polnoč. Vse luči ugasnjene, razen ene rdeče.' },
      { who: 'dark', mood: 'angry', text: 'Štirje kompresorji, en ukaz: piskajte! Vsak sunek zraka je moj.', act: 'glitch' },
      { who: 'genko', mood: 'worried', text: 'Dve fazi brez odmora: najprej priklop, takoj zatem lov na konico.' },
      { who: 'dark', mood: 'smirk', text: 'Če padeš v prvi fazi, druge sploh ne boš videl.', act: 'laugh' },
    ],
  },
  {
    id: 'r1-taunt',
    title: 'Temni števec se smeji',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Že konec? Kompresorji so komaj začeli piskati.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Brez vseh merilnikov v prvi fazi v drugi lovim konico na slepo.' },
      { who: 'genko', mood: 'smug', text: 'Še enkrat. Tokrat vem, kje so pasti.' },
    ],
  },
  {
    id: 'r1-ko',
    title: 'Boss · Udar podatkov',
    tone: 'boss',
    facility: 'kompresorji',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Zadnji podatek priteče v oblak. Graf se izriše do konca.' },
      { who: 'genko', mood: 'smug', text: 'Vidim te, Temni števec. Vsak sunek, vsako noč, vsak kWh.', act: 'scan' },
      { who: 'dark', mood: 'angry', text: 'Ne! Brez teme me ni!' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Prehod, pošlji vse!' },
      { who: 'dark', mood: 'hurt', fx: 'flash', text: 'Aaaah … preveč luči …' },
      { who: 'narrator', fx: 'light', text: 'Kompresorska postaja se prižge. Ponoči končno utihne.' },
    ],
  },
  {
    id: 'r1-victory',
    title: 'Industrijska cona je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'narrator', text: 'Jutro. Industrijska cona prvič diha brez nočnega piskanja.' },
      { who: 'genko', mood: 'wow', text: 'Kompresorji ponoči spijo, kot se spodobi. Industrijska cona je naša!' },
      { who: 'dark', mood: 'fleeing', text: 'Mleko se kisa hitreje kot tvoja sreča. Se vidiva v Mlekarni.' },
      { who: 'narrator', text: 'Na tleh je ostal star aluminijast kolut. Vgravirano: Š-0, 1987.', shot: 'establish', act: 'reveal' },
      { who: 'genko', mood: 'smug', text: 'Š-0? Ničti števec? … To si bom zapomnil.', shot: 'genko' },
    ],
  },
  // ── Poglavje 2 · Mlekarna ─────────────────────────────────────────
  {
    id: 'r2-intro',
    title: 'Poglavje 2 · Hladna veriga',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Mlekarna. Hladna veriga, ki se ne sme pretrgati niti za minuto.' },
      { who: 'genko', mood: 'happy', text: 'Hladilnice delajo tudi za vikend. Tu je vsak kWh dvakrat drag: enkrat za hlajenje, enkrat za napako.' },
      { who: 'dark', mood: 'smirk', text: 'Ena vrata ostanejo odprta. En števec malce laže. Vsote nihče ne preverja.' },
      { who: 'genko', mood: 'smug', text: 'Jaz jo. Vedno.' },
    ],
  },
  {
    id: 'fac-hladilnica',
    title: 'Hladilnica se prižge',
    tone: 'lit',
    facility: 'hladilnica',
    lines: [
      { who: 'narrator', text: 'Hladilnica. Štiri stopinje v komorah in kilovatne ure, ki jih nihče ne šteje.' },
      { who: 'genko', mood: 'worried', text: 'Vrata komore B so bila včeraj odprta 40 minut. Agregat je delal kot nor.', act: 'scan' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Sonde poročajo vsako minuto. Ko vrata zevajo, dobi vodja izmene opozorilo.' },
      { who: 'dark', mood: 'smirk', text: 'Mraz je potrpežljiv. Jaz tudi.' },
    ],
  },
  {
    id: 'fac-pakirnica',
    title: 'Pakirnica se prižge',
    tone: 'lit',
    facility: 'pakirnica',
    lines: [
      { who: 'narrator', text: 'Pakirnica. Pasterizator greje, agregat hladi. Oba hkrati, ob isti uri.' },
      { who: 'genko', mood: 'smug', text: 'Če pasterizacijo zamaknemo za deset minut, se konici ne srečata.', act: 'connect' },
      { who: 'narrator', fx: 'light', text: 'Pakirnica se osvetli. Linije tečejo v ritmu.' },
      { who: 'dark', mood: 'hurt', text: 'Ritem … sovražim ritem.' },
      { who: 'narrator', text: 'V arhivu pakirnice leži shema elektro omare iz leta 1987. V kotu je narisan števec z oznako Š-0.', shot: 'facility', act: 'reveal' },
    ],
  },
  {
    id: 'r2-boss',
    title: 'Boss · Lažnivec na TP',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Trafo postaja mlekarne. Dvanajst števcev. Vsota se ne ujema.' },
      { who: 'dark', mood: 'angry', text: 'Eden od njih je moj. Najdi ga, če znaš. Ampak najprej ga moraš priklopiti.', act: 'glitch' },
      { who: 'genko', mood: 'worried', text: 'Kjer se vsota ne ujema, nekdo laže. Ali krade. Ali oboje.' },
    ],
  },
  {
    id: 'r2-taunt',
    title: 'Lažnivec se smeji',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Iskal si lažnivca, našel pa si samo svojo napako.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Faze si sledijo brez odmora. Najprej priklop, nato detektiv. Tokrat pazim na naslove.' },
    ],
  },
  {
    id: 'r2-ko',
    title: 'Boss · Trinajsti števec',
    tone: 'boss',
    facility: 'trafo',
    lines: [
      { who: 'narrator', text: 'Dvanajst števcev. Vsota se končno ujema do zadnjega kilovata.' },
      { who: 'genko', mood: 'smug', text: 'Ti si trinajsti, kajne? Tisti, ki ga ni na nobeni shemi.', act: 'scan' },
      { who: 'dark', mood: 'angry', text: 'Bil sem prvi! Pred vsemi dvanajstimi!' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Tokovni transformator je popravljen. Pošiljam meritve!' },
      { who: 'dark', mood: 'hurt', fx: 'flash', text: 'Moja polovica … moja skrita polovica …' },
      { who: 'narrator', fx: 'light', text: 'Trafo postaja zasveti. Mlekarna ima končno pošten račun.' },
    ],
  },
  {
    id: 'r2-victory',
    title: 'Mlekarna je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'narrator', text: 'Jutro v mlekarni. Mleko je hladno, števci govorijo resnico.' },
      { who: 'genko', mood: 'wow', text: 'Napačno vezan tokovni transformator. Leta je kazal polovico porabe.' },
      { who: 'narrator', text: 'V omarici je ostala zbledela nalepka: »Š-0 · glavni števec mlekarne · odstranjen 2009«.', shot: 'establish', act: 'reveal' },
      { who: 'genko', mood: 'worried', text: 'Spet Š-0. Bil je glavni števec. Nekdo ga je zamenjal in nanj pozabil.' },
      { who: 'dark', mood: 'fleeing', text: 'Pozabili so me. Kot pozabijo vse, kar ne piska. Pod zemljo me boš slišal.' },
    ],
  },
  // ── Poglavje 3 · Komunala ─────────────────────────────────────────
  {
    id: 'r3-intro',
    title: 'Poglavje 3 · Glasovi pod zemljo',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Komunala. Pod mestom teče voda, nad njim letijo radijski paketi.' },
      { who: 'genko', mood: 'happy', text: 'Vodomeri vsakih nekaj minut zašepetajo stanje. Če jih nihče ne posluša, voda teče v prazno.' },
      { who: 'dark', mood: 'smirk', text: 'Tišina je moja najljubša frekvenca.' },
      { who: 'genko', mood: 'smug', text: 'Dobro, da imam antene.', act: 'scan' },
    ],
  },
  {
    id: 'fac-vodarna',
    title: 'Vodarna se prižge',
    tone: 'lit',
    facility: 'vodarna',
    lines: [
      { who: 'narrator', text: 'Vodarna. Vodohran nad mestom in sto vodomerov, ki šepetajo po radiu.' },
      { who: 'genko', mood: 'happy', text: 'Vsak vodomer pošlje paket vsakih nekaj minut. Moramo jih samo slišati.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Prehodi na strehah, repetitorji na drogovih. Slišim vse!' },
      { who: 'dark', mood: 'smirk', text: 'Slišiš vodo. Mene ne.' },
      { who: 'narrator', text: 'Med paketi se pojavi tuj. Brez naslova. Samo dva znaka: Š-0.', act: 'glitch' },
    ],
  },
  {
    id: 'fac-cistilna',
    title: 'Čistilna naprava se prižge',
    tone: 'lit',
    facility: 'cistilna',
    lines: [
      { who: 'narrator', text: 'Čistilna naprava. Puhala ženejo zrak v bazene noč in dan.' },
      { who: 'genko', mood: 'worried', text: 'Brez meritve kisika pihajo na polno. To je skoraj polovica vse elektrike.' },
      { who: 'genko', mood: 'smug', fx: 'light', text: 'Sonda kisika in krmiljenje po meri. Puhala zdaj dihajo pametno.' },
      { who: 'dark', mood: 'angry', text: 'Bakterije so bile moje zaveznice!' },
      { who: 'genko', mood: 'happy', text: 'Bakterije so zdaj samo site. In mi tudi.' },
    ],
  },
  {
    id: 'r3-boss',
    title: 'Boss · Čistilna, ki diha',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Čistilna naprava. Vsa puhala hkrati na polno. Vsi radijski števci utihnili.' },
      { who: 'dark', mood: 'angry', text: 'Brez podatkov ne veš, koliko zraka rabijo bakterije. Zato pihaš na polno. Zame.', act: 'glitch' },
      { who: 'genko', mood: 'worried', text: 'Najprej radijsko omrežje, potem konica. Ko vodomeri spet govorijo, puhala vodimo po resnici.' },
    ],
  },
  {
    id: 'r3-taunt',
    title: 'Tišina na frekvenci',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Tišina. Moja najljubša frekvenca, sem ti rekel.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Kjer ni signala, ni podatka. Najprej omrežje, potem konica. Še enkrat.' },
    ],
  },
  {
    id: 'r3-ko',
    title: 'Boss · Naliv',
    tone: 'boss',
    facility: 'crpalisce',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Naliv. Črpališče dela za tri, radijski števci pa končno vsi poročajo.' },
      { who: 'dark', mood: 'angry', text: 'Voda bo odnesla tvoje podatke!' },
      { who: 'genko', mood: 'smug', text: 'Prehod ima lokalni pomnilnik. Nič ne izgine.' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Repetitorji, zdaj!' },
      { who: 'dark', mood: 'hurt', fx: 'flash', text: 'Šum … preveč signala …' },
      { who: 'narrator', fx: 'light', text: 'Črpališče zasveti. Mesto ostane suho.' },
    ],
  },
  {
    id: 'r3-victory',
    title: 'Komunala je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'narrator', text: 'Po nalivu. Kanali so polni, števci zgovorni.' },
      { who: 'genko', mood: 'wow', text: 'Komunala diha. In voda ponoči ne teče več v nič.' },
      { who: 'narrator', text: 'V arhivu komunale: delovni nalog iz leta 2009. »Š-0 preseliti v Center. Odčitavanje: ni potrebno.«', shot: 'establish', act: 'reveal' },
      { who: 'genko', mood: 'worried', text: 'Ni potrebno … Leta in leta ga nihče ni odčital. Štel je sam zase. In nihče ga ni poslušal.' },
      { who: 'dark', mood: 'fleeing', text: 'Pozimi bo mesto zmrznilo. Takrat bodo spet potrebovali mene.' },
    ],
  },
  // ── Poglavje 4 · Kogeneracija ─────────────────────────────────────
  {
    id: 'r4-intro',
    title: 'Poglavje 4 · Zima',
    tone: 'dark',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Kogeneracija. En motor, dva produkta: elektrika in toplota.' },
      { who: 'genko', mood: 'happy', text: 'Toplota mora po ceveh do vsake stavbe. In nobena kaplja ne sme pobegniti v zemljo.' },
      { who: 'dark', mood: 'smirk', text: 'Vsaka kaplja, ki uide v zemljo, greje mene.' },
    ],
  },
  {
    id: 'fac-toplarna',
    title: 'Toplarna se prižge',
    tone: 'lit',
    facility: 'toplarna',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Toplarna. Plinski motor, ki ga je nekdo nastavil tako, da teče tudi takrat, ko je elektrika poceni.' },
      { who: 'genko', mood: 'worried', text: 'Ob treh zjutraj prodajamo elektriko po ceni, ki ne pokrije niti plina.', act: 'scan' },
      { who: 'genko', mood: 'smug', fx: 'light', text: 'Nove cevi, zaprti konci, nič puščanja. Toplota pride do zadnjega radiatorja.' },
      { who: 'dark', mood: 'smirk', text: 'Zima je dolga, robotek.' },
    ],
  },
  {
    id: 'fac-bolnisnicni',
    title: 'Bolnišnični CHP se prižge',
    tone: 'lit',
    facility: 'bolnisnicni',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Bolnišnični CHP. Tu toplota ne sme zmanjkati niti za minuto.' },
      { who: 'genko', mood: 'worried', text: 'Operacijske dvorane, porodnišnica, sterilizacija. Vse visi na eni enoti.' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Rezervni načrt, alarmi in napoved odjema. Bolnišnica je na varnem.' },
      { who: 'dark', mood: 'hurt', text: 'Bolnišnica … ta odvod sem nekoč štel jaz.' },
      { who: 'narrator', text: 'Na stari omari v kleti visi zarjavela tablica: »Napajanje iz Centra, odvod Š-0«.', shot: 'facility', act: 'reveal' },
    ],
  },
  {
    id: 'r4-boss',
    title: 'Boss · Zimska špica',
    tone: 'boss',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Najmrzlejši dan v letu. Dve enoti. Pol mesta na eni zanki.' },
      { who: 'dark', mood: 'angry', text: 'Sukal bom cevi, ko jih boš ravno poravnal. Ko zmrznejo radiatorji, bodo prosili zame.', act: 'glitch' },
      { who: 'genko', mood: 'smug', text: 'Tokrat ne. Vsako cev zasukam nazaj, potem po števcih najdem vsako puščanje.' },
    ],
  },
  {
    id: 'r4-taunt',
    title: 'Zmrzal se smeji',
    tone: 'boss',
    weather: 'snow',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Zebe? Mene nikoli.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Hitreje zasukam, kot on zmeša. In števci povedo, kje pušča. Gremo še enkrat.' },
    ],
  },
  {
    id: 'r4-ko',
    title: 'Boss · Topla zanka',
    tone: 'boss',
    facility: 'daljinsko',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Minus petnajst. Zanka je sklenjena, puščanja zaprta, radiatorji so topli.' },
      { who: 'dark', mood: 'angry', text: 'Moralo bi zmrzniti! Vse mesto bi moralo prositi zame!' },
      { who: 'genko', mood: 'smug', text: 'Nihče ne bo prosil. Vse je izmerjeno.' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Polna moč, zapiram zanko!' },
      { who: 'dark', mood: 'hurt', fx: 'flash', text: 'Toplo … zakaj je tako toplo …' },
      { who: 'narrator', fx: 'light', text: 'Daljinsko ogrevanje zasveti. Pol mesta spi na toplem.' },
    ],
  },
  {
    id: 'r4-victory',
    title: 'Kogeneracija je osvetljena',
    tone: 'dawn',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Zora nad toplarno. Dimnik se kadi mirno in enakomerno.' },
      { who: 'genko', mood: 'wow', text: 'Ker smo izmerili vsak kilovat toplote, preden bi ga izgubili.' },
      { who: 'narrator', text: 'Na zaslonu toplarne utripne naslov: Center, stara razdelilna postaja, omara Š-0.', shot: 'establish', act: 'reveal' },
      { who: 'genko', mood: 'worried', text: 'Tam je. Kjer se je vse začelo.' },
      { who: 'dark', mood: 'fleeing', text: 'Pridi. A najprej boš moral rešiti zdravstvene domove. Tam alarmi ne čakajo.' },
    ],
  },
  // ── Poglavje 5 · Zdravstvo ────────────────────────────────────────
  {
    id: 'r5-intro',
    title: 'Poglavje 5 · Noč v ambulanti',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Zdravstveni dom, enajst zvečer. V hladilniku spijo cepiva za tisoč otrok.' },
      { who: 'genko', mood: 'worried', text: 'Med 2 in 8 °C. Ena sama noč pri dvanajstih in vse gre v uničenje.', act: 'scan' },
      { who: 'dark', mood: 'smirk', text: 'Toplota je potrpežljiva. Pride počasi, stopinjo za stopinjo. Nihče ne gleda ob treh zjutraj.' },
      { who: 'genko', mood: 'smug', text: 'Jaz gledam. In ko bo narobe, bo dežurni izvedel v sekundi.' },
      { who: 'dark', mood: 'angry', text: 'Potem pa poglejmo, ali ločiš moje meritve od pravih. Poslal jih bom na tisoče.', act: 'glitch' },
    ],
  },
  {
    id: 'fac-zdcenter',
    title: 'ZD Center se prižge',
    tone: 'lit',
    facility: 'zdcenter',
    lines: [
      { who: 'narrator', text: 'ZD Center. Trije hladilniki, en dežurni in meritve, ki so končno preverjene.' },
      { who: 'genko', mood: 'happy', text: 'Vratni kontakt, napajanje, temperatura. Ko zazvoni, je jasno, zakaj.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Cepilni center je pod nadzorom. Lažne meritve ostanejo zunaj kartona.' },
      { who: 'dark', mood: 'hurt', text: 'Tišina je bila moja. Zdaj zvoni samo, ko je res treba.' },
    ],
  },
  {
    id: 'fac-dostava',
    title: 'Hladna dostava se prižge',
    tone: 'lit',
    facility: 'dostava',
    weather: 'snow',
    lines: [
      { who: 'narrator', text: 'Hladna dostava. Kurirji vozijo cepiva čez sneg, v torbah pa tiho merijo zapisovalniki.' },
      { who: 'genko', mood: 'worried', text: 'Torba je obtičala na obvoznici. Vložki se talijo. Še pet stopinj do meje.', act: 'scan' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Najbližji ZD ima sveže vložke. Pošiljka ostane v območju vso pot!' },
      { who: 'dark', mood: 'smirk', text: 'Vso pot. A pot se še ni končala, robotek.' },
      { who: 'narrator', text: 'V zapisovalniku zadnje torbe je star vnos iz leta 1991: »Odvod bolnišnica, napajanje Š-0, izpad 4 ure«.', act: 'reveal' },
    ],
  },
  {
    id: 'r5-boss',
    title: 'Boss · Noč treh domov',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Polnoč. Nevihta nad mestom. V treh zdravstvenih domovih hkrati utihnejo senzorji.' },
      { who: 'dark', mood: 'angry', text: 'Tisto noč leta 1991 sem štel vsako sekundo izpada. Štiri ure. Nihče ni vprašal, koliko.', act: 'glitch' },
      { who: 'genko', mood: 'worried', text: 'Najprej senzorje nazaj na prehod. Potem prestrežem vsako tvojo lažno meritev.' },
      { who: 'dark', mood: 'smirk', text: 'Danes boš ti štel sekunde. Sam.', act: 'laugh' },
    ],
  },
  {
    id: 'r5-taunt',
    title: 'Alarm, ki ga nihče ne sliši',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Slišiš? Zvoni. In zvoni. In nihče ne pride.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Preveč lažnih je prišlo skozi. Bodice režem, modrih in križev ne. Še enkrat.' },
    ],
  },
  {
    id: 'r5-ko',
    title: 'Boss · Vse v območju',
    tone: 'boss',
    facility: 'lekarna',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Tri ure zjutraj. Vsi hladilniki v treh domovih kažejo med 2 in 8 °C.' },
      { who: 'genko', mood: 'smug', text: 'Vsaka lažna meritev prestrežena. Vsak pravi alarm je prišel do dežurnega.', act: 'scan' },
      { who: 'dark', mood: 'angry', text: 'Zakaj jih rešuješ? Saj te nihče ne vidi!' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Ker jih nekdo mora brati. Agregati, zdaj!' },
      { who: 'dark', mood: 'hurt', fx: 'flash', text: 'Tako svetlo … kot tisto jutro, ko so prižgali luči v bolnišnici …' },
      { who: 'narrator', fx: 'light', text: 'Bolnišnična lekarna zasveti. Cepiva za tisoč otrok so na varnem.' },
    ],
  },
  {
    id: 'r5-victory',
    title: 'Zdravstvo je osvetljeno',
    tone: 'dawn',
    lines: [
      { who: 'narrator', text: 'Jutro. Medicinska sestra odpre hladilnik. Pet stopinj. Kot vsak dan.' },
      { who: 'genko', mood: 'happy', text: 'Nihče ne bo vedel, kaj se je zgodilo ponoči. In tako je prav.' },
      { who: 'dark', mood: 'hurt', text: 'Jaz bom vedel. Vedno vem. To je moje prekletstvo.', shot: 'dark' },
      { who: 'genko', mood: 'worried', text: 'Ni prekletstvo, Š-0. Spomin je. Samo nihče ga še ni prebral.' },
      { who: 'dark', mood: 'fleeing', text: 'Pridi v Center. V klet. Tam je vse, kar sem kdaj štel. Če si upaš.' },
    ],
  },
  // ── Poglavje 6 · Center Temnega števca ────────────────────────────
  {
    id: 'r6-intro',
    title: 'Poglavje 6 · Klet Centra',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Center. Stara razdelilna postaja, zaprta od leta 2009. Vrata v klet so odklenjena.' },
      { who: 'genko', mood: 'wow', text: 'Police do stropa. Trakovi, diskete, zvezki. Vse označeno s Š-0.', act: 'scan', shot: 'establish' },
      { who: 'dark', mood: 'smirk', text: 'Devetintrideset let. Vsak mesec, vsak kilovat. Popolna zgodovina mesta, ki je nihče ni hotel.' },
      { who: 'genko', mood: 'happy', text: 'Jaz jo hočem. Prenesla jo bova v InGenious. Zapis za zapisom.' },
      { who: 'dark', mood: 'angry', text: 'Prenesla? Tako so rekli tudi leta 2009. Nov števec, star gre v klet!', act: 'glitch' },
    ],
  },
  {
    id: 'fac-arhiv',
    title: 'Arhiv meritev se prižge',
    tone: 'lit',
    facility: 'arhiv',
    lines: [
      { who: 'narrator', text: 'Arhiv meritev. Prvi trakovi so prebrani. Enote preverjene, dvojniki zavrženi.' },
      { who: 'genko', mood: 'wow', text: 'Januar 1987, Livarna: 12 480 kWh. Prvi odčitek Š-0. Po devetintridesetih letih spet berljiv.', act: 'connect' },
      { who: 'narrator', fx: 'light', text: 'Arhiv zasveti. Zgodovina mesta teče v platformo.' },
      { who: 'dark', mood: 'hurt', text: 'Ta številka … napisal sem jo s tresočim kolutom. Prvi dan.' },
    ],
  },
  {
    id: 'fac-razdelilna',
    title: 'Razdelilna postaja se prižge',
    tone: 'lit',
    facility: 'razdelilna',
    lines: [
      { who: 'narrator', text: 'Stara razdelilna postaja. Od tod je nekoč tekla elektrika za pol mesta.' },
      { who: 'genko', mood: 'happy', text: 'Odvodi so povezani, števci v kleti spet slišijo prehod.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Postaja živi! In zdaj vemo, koliko je porabila vsak mesec od leta 1987.' },
      { who: 'dark', mood: 'hurt', text: 'Ne razumem. Bereš me … in me ni manj.' },
      { who: 'genko', mood: 'smug', text: 'Seveda ne. Prebran števec ne izgine. Prebran števec šteje.' },
    ],
  },
  {
    id: 'r6-boss',
    title: 'Finale · Omara Š-0',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Na koncu hodnika je omara. Na njej en sam rdeč utrip. Š-0.', act: 'reveal', shot: 'establish' },
      { who: 'dark', mood: 'angry', text: 'Še korak in boš prebral zadnji zapis. Potem me boste zamenjali. Kot vedno.', act: 'glitch' },
      { who: 'genko', mood: 'worried', text: 'Tri faze. Odprem omaro, prestanem tvojo konico in preberem tvoj spomin. Do zadnjega zapisa.' },
      { who: 'dark', mood: 'smirk', text: 'Prižgal bom vse, kar sem kdaj štel. Naenkrat. Pa da vidim, kako bereš.', act: 'laugh' },
    ],
  },
  {
    id: 'r6-taunt',
    title: 'Še en pozabljen zapis',
    tone: 'boss',
    weather: 'storm',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Vidiš? Tudi ti si izgubil zapise. Vsi jih izgubijo. Zato sem sam.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Ne bom te pustil v kleti. Preveri enote, zavrzi dvojnike, ne izgubi nobenega meseca. Še enkrat.' },
    ],
  },
  {
    id: 'r6-ko',
    title: 'Finale · Prebran',
    tone: 'boss',
    facility: 'omara',
    weather: 'storm',
    lines: [
      { who: 'narrator', text: 'Zadnji zapis. December 2025. Celovitost sto odstotkov.' },
      { who: 'dark', mood: 'angry', text: 'Zdaj me boš izbrisal. Zdaj sem samo še stara številka v tvoji bazi!' },
      { who: 'genko', mood: 'smug', text: 'Ne. Zdaj si prvi merilnik v mojem omrežju. Tisti z najdaljšo zgodovino.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Š-0, odčitek številka ena po devetintridesetih letih. Prehod, beri!' },
      { who: 'dark', mood: 'healed', fx: 'flash', text: 'Kaj … kaj je to? Ne boli. Samo … toplo je. Nekdo me bere.', act: 'heal' },
      { who: 'narrator', fx: 'light', text: 'Omara Š-0 zasveti zeleno. Prvič po letu 1987 jo nekdo bere vsak dan.' },
    ],
  },
  {
    id: 'r6-victory',
    title: 'Epilog · Vse je izmerjeno',
    tone: 'dawn',
    weather: 'clear',
    lines: [
      { who: 'narrator', text: 'Zora nad mestom. Tovarne, mlekarna, vodarna, toplarna, bolnišnica. Vse luči gorijo.', act: 'dawn' },
      { who: 'dark', mood: 'healed', text: 'Vsak mesec od leta 1987. Zdaj ga vidijo vsi. Mislil sem, da hočem temo. Hotel sem samo, da me kdo prebere.' },
      { who: 'genko', mood: 'happy', text: 'Dobrodošel v omrežju, Š-0. Tvoja zgodovina je naše izhodišče. Z njo dokažemo vsak prihranek.', shot: 'two' },
      { who: 'dark', mood: 'healed', text: 'Potem začniva. Livarna je ponoči spet pustila prižgano linijo. Videl sem.', shot: 'dark' },
      { who: 'genko', mood: 'wow', text: 'Partner! Vedel sem, da imaš dobro oko.', act: 'flyin', shot: 'two' },
      { who: 'narrator', text: 'Kar je izmerjeno, ni pozabljeno. InGenious Grid Rush. Konec.', shot: 'establish' },
    ],
  },
  // ── Poglavje 7 · Š-1 ──────────────────────────────────────────────
  {
    id: 'r7-intro',
    title: 'Poglavje 7 · Brat v kleti',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Podeželje. Stara kmetijska zadruga, pred njo novo parkirišče s polnilnicami.' },
      { who: 'genko', mood: 'worried', text: 'Polnilnice delajo, a avtomobili ne pridejo do njih. Nekdo je parkiral tako, da je vse zaprto.', act: 'scan' },
      { who: 'dark', mood: 'smirk', text: 'Jaz sem Š-1. Brat tistega, ki si ga prebral v mestu. Mene ni bral nihče.' },
      { who: 'genko', mood: 'smug', text: 'Potem bom pa začel. Avto za avtom, polnilnico za polnilnico.' },
      { who: 'dark', mood: 'angry', text: 'Parkirišče je moje. Vsak kilovat, ki gre v avto, gre mimo mene.', act: 'glitch' },
    ],
  },
  {
    id: 'fac-zadruga',
    title: 'Parkirišče zadruge se prižge',
    tone: 'lit',
    facility: 'zadruga',
    weather: 'clear',
    lines: [
      { who: 'narrator', text: 'Parkirišče zadruge. Dve polnilnici, ki sta pol leta stali prazni.' },
      { who: 'genko', mood: 'happy', text: 'Avtomobili so na polnilnicah, števci so priklopljeni.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Vsaka polnitev izmerjena in zaračunana. Zadruga prvič zasluži z elektriko!' },
      { who: 'dark', mood: 'hurt', text: 'Dve polnilnici sta malo. Na avtocesti jih je šest.' },
    ],
  },
  {
    id: 'fac-hub',
    title: 'Polnilni hub se prižge',
    tone: 'lit',
    facility: 'hub',
    weather: 'clear',
    lines: [
      { who: 'narrator', text: 'Hitri hub ob avtocesti. Šest polnilnic, en priključek in petkova gneča.' },
      { who: 'genko', mood: 'worried', text: 'Če se vsi priklopijo hkrati, priključek odpove.', act: 'scan' },
      { who: 'genko', mood: 'smug', fx: 'light', text: 'Upravljanje obremenitve. Moč se deli, nihče ne čaka predolgo.' },
      { who: 'dark', mood: 'angry', text: 'Pridi v klet, robotek. Tam ni signala in ni pomoči.' },
      { who: 'narrator', text: 'Na kleti zadruge visi tablica: »Š-1, odvod zadruga, mlin, vaška razsvetljava«.', shot: 'facility', act: 'reveal' },
    ],
  },
  {
    id: 'r7-boss',
    title: 'Boss · Š-1',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Klet zadruge. Š-1 utripa rdeče, zunaj se gnete deset avtomobilov.' },
      { who: 'dark', mood: 'angry', text: 'Najprej bom prižgal vse naenkrat. Potem bo moj črni avto zaprl vsako pot.', act: 'glitch' },
      { who: 'genko', mood: 'smug', text: 'Najprej ukrotim konico. Potem prehitim tvoj avto. Vidim, kam bo zapeljal.' },
    ],
  },
  {
    id: 'r7-taunt',
    title: 'Parkirišče je zaprto',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Zaprto! Nihče ne bo polnil.', act: 'laugh' },
      { who: 'genko', mood: 'worried', text: 'Njegov avto se premakne po vsakih nekaj mojih potezah. Moram ga predvideti. Še enkrat.' },
    ],
  },
  {
    id: 'r7-ko',
    title: 'Boss · Odprto parkirišče',
    tone: 'boss',
    facility: 'klet',
    lines: [
      { who: 'narrator', text: 'Zadnji avto zapelje na polnilnico. Črni avto stoji v kotu, brez poti.' },
      { who: 'dark', mood: 'angry', text: 'Kako? Zaprl sem vse!' },
      { who: 'genko', mood: 'smug', text: 'Ker sem videl vsako potezo, preden si jo naredil. Tako kot bratovo zgodovino.', act: 'connect' },
      { who: 'genko', mood: 'wow', fx: 'zap', text: 'Š-1, odčitek številka ena. Prehod, beri!' },
      { who: 'dark', mood: 'healed', fx: 'flash', text: 'Brat … ti si tisti, ki je bral brata? Potem … beri še mene.', act: 'heal' },
      { who: 'narrator', fx: 'light', text: 'Klet zadruge zasveti zeleno. Polnilni park je osvetljen.' },
    ],
  },
  {
    id: 'r7-victory',
    title: 'Polnilni park je osvetljen',
    tone: 'dawn',
    weather: 'clear',
    lines: [
      { who: 'narrator', text: 'Jutro na podeželju. Pred zadrugo se polnijo avtomobili, traktor in dostavni kombi.', act: 'dawn' },
      { who: 'dark', mood: 'healed', text: 'Brat mi je povedal, da je v omrežju lepo. Da te kdo pogleda vsak dan.' },
      { who: 'genko', mood: 'happy', text: 'Dobrodošel, Š-1. Zdaj štejeta oba. Mesto in vas.', shot: 'two' },
      { who: 'narrator', text: 'Kar je izmerjeno, ni pozabljeno. Tudi na podeželju.', shot: 'establish' },
    ],
  },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id);
export const sceneKey = (id: string) => `scene:${id}`;
