/**
 * The story: who is the Dark Meter? Every region peels off one layer of the
 * mystery of "Š-0", the first meter of the old grid that nobody read again.
 */
export type Speaker = 'genko' | 'dark' | 'narrator';
export type StoryMood = 'happy' | 'smug' | 'worried' | 'wow' | 'smirk' | 'angry' | 'hurt' | 'fleeing';

export interface StoryLine {
  who: Speaker;
  mood?: StoryMood;
  text: string;
}

export interface Scene {
  id: string;
  title: string;
  /** Background mood: dark = the villain's turf, dawn = after a victory. */
  tone: 'dark' | 'boss' | 'dawn';
  lines: StoryLine[];
}

export const SCENES: Scene[] = [
  {
    id: 'r1-intro',
    title: 'Poglavje 1 · Tihi stroji',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Leto 2031. Slovenija ima več merilnikov kot kadarkoli. Polovica jih molči.' },
      { who: 'genko', mood: 'worried', text: 'Industrijska cona. Slišiš to piskanje? Kompresorji ob treh zjutraj. Nekdo jih hrani.' },
      { who: 'dark', mood: 'smirk', text: 'Kar ni izmerjeno, je moje. Tako je bilo vedno.' },
      { who: 'genko', mood: 'worried', text: 'Temni števec. Hrani se z energijo, ki je nihče ne vidi: ponoči, v konicah, v puščajočih ceveh.' },
      { who: 'dark', mood: 'smirk', text: 'Ti si samo še en robotek z grafom. Videl sem jih sto. Vsi so ugasnili.' },
      { who: 'genko', mood: 'smug', text: 'Noben pa ni imel tebe za partnerja. Priklopiva merilnike in osvetliva tovarno.' },
    ],
  },
  {
    id: 'r1-boss',
    title: 'Boss · Postaja, ki piska ponoči',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Kompresorska postaja. Polnoč. Vse luči ugasnjene, razen ene rdeče.' },
      { who: 'dark', mood: 'angry', text: 'Štirje kompresorji, en ukaz: piskajte! Vsak sunek zraka je moj.' },
      { who: 'genko', mood: 'worried', text: 'Boss ima dve fazi brez odmora: najprej priklop, takoj zatem lov na konico.' },
      { who: 'dark', mood: 'smirk', text: 'Če padeš v prvi fazi, druge sploh ne boš videl.' },
    ],
  },
  {
    id: 'r1-victory',
    title: 'Industrijska cona je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'dark', mood: 'hurt', text: 'Ne … luči … preveč podatkov!' },
      { who: 'genko', mood: 'wow', text: 'Kompresorji ponoči spijo, kot se spodobi. Industrijska cona je naša!' },
      { who: 'dark', mood: 'fleeing', text: 'Mleko se kisa hitreje kot tvoja sreča. Se vidiva v Mlekarni.' },
      { who: 'narrator', text: 'Na tleh je ostal star aluminijast kolut. Vgravirano: Š-0, 1987.' },
      { who: 'genko', mood: 'smug', text: 'Š-0? Ničti števec? … To si bom zapomnil.' },
    ],
  },
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
    id: 'r2-boss',
    title: 'Boss · Lažnivec na TP',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Trafo postaja mlekarne. Dvanajst števcev. Vsota se ne ujema.' },
      { who: 'dark', mood: 'angry', text: 'Eden od njih je moj. Najdi ga, če znaš. Ampak najprej ga moraš priklopiti.' },
      { who: 'genko', mood: 'worried', text: 'Kjer se vsota ne ujema, nekdo laže. Ali krade. Ali oboje.' },
    ],
  },
  {
    id: 'r2-victory',
    title: 'Mlekarna je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'dark', mood: 'hurt', text: 'Moj lažnivec … razkrinkan.' },
      { who: 'genko', mood: 'wow', text: 'Napačno vezan tokovni transformator. Leta je kazal polovico porabe.' },
      { who: 'narrator', text: 'V omarici je ostala zbledela nalepka: »Š-0 · glavni števec mlekarne · odstranjen 2009«.' },
      { who: 'genko', mood: 'worried', text: 'Spet Š-0. Bil je glavni števec. Nekdo ga je zamenjal in nanj pozabil.' },
      { who: 'dark', mood: 'fleeing', text: 'Pozabili so me. Kot pozabijo vse, kar ne piska. Pod zemljo me boš slišal.' },
    ],
  },
  {
    id: 'r3-intro',
    title: 'Poglavje 3 · Glasovi pod zemljo',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Komunala. Pod mestom teče voda, nad njim letijo radijski paketi.' },
      { who: 'genko', mood: 'happy', text: 'Vodomeri vsakih nekaj minut zašepetajo stanje. Če jih nihče ne posluša, voda teče v prazno.' },
      { who: 'dark', mood: 'smirk', text: 'Tišina je moja najljubša frekvenca.' },
      { who: 'genko', mood: 'smug', text: 'Dobro, da imam antene.' },
    ],
  },
  {
    id: 'r3-boss',
    title: 'Boss · Čistilna, ki diha',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Čistilna naprava. Vsa puhala hkrati na polno. Vsi radijski števci utihnili.' },
      { who: 'dark', mood: 'angry', text: 'Brez podatkov ne veš, koliko zraka rabijo bakterije. Zato pihaš na polno. Zame.' },
      { who: 'genko', mood: 'worried', text: 'Najprej radijsko omrežje, potem konica. Ko vodomeri spet govorijo, puhala vodimo po resnici.' },
    ],
  },
  {
    id: 'r3-victory',
    title: 'Komunala je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'dark', mood: 'hurt', text: 'Slišijo … vsi me slišijo.' },
      { who: 'genko', mood: 'wow', text: 'Komunala diha. In voda ponoči ne teče več v nič.' },
      { who: 'narrator', text: 'V arhivu komunale: delovni nalog iz leta 2009. »Š-0 preseliti v Center. Odčitavanje: ni potrebno.«' },
      { who: 'genko', mood: 'worried', text: 'Ni potrebno … Leta in leta ga nihče ni odčital. Štel je sam zase. In nihče ga ni poslušal.' },
      { who: 'dark', mood: 'fleeing', text: 'Pozimi bo mesto zmrznilo. Takrat bodo spet potrebovali mene.' },
    ],
  },
  {
    id: 'r4-intro',
    title: 'Poglavje 4 · Zima',
    tone: 'dark',
    lines: [
      { who: 'narrator', text: 'Kogeneracija. En motor, dva produkta: elektrika in toplota.' },
      { who: 'genko', mood: 'happy', text: 'Elektriko prodaš, ko je draga. Toploto shraniš, ko je ne rabiš. Zveni preprosto. Ni.' },
      { who: 'dark', mood: 'smirk', text: 'Vsaka toplota, ki jo vržeš v hladilnik, greje mene.' },
    ],
  },
  {
    id: 'r4-boss',
    title: 'Boss · Zimska špica',
    tone: 'boss',
    lines: [
      { who: 'narrator', text: 'Najmrzlejši dan v letu. Dve enoti. Pol mesta na eni zanki.' },
      { who: 'dark', mood: 'angry', text: 'Zmešal sem jim vse nastavitve. Ko zmrznejo radiatorji, bodo prosili zame.' },
      { who: 'genko', mood: 'smug', text: 'Tokrat ne. Najprej poveži, potem vozi. Topli domovi in visok izkoristek.' },
    ],
  },
  {
    id: 'r4-victory',
    title: 'Kogeneracija je osvetljena',
    tone: 'dawn',
    lines: [
      { who: 'dark', mood: 'hurt', text: 'Toplo je … Zakaj je toplo?' },
      { who: 'genko', mood: 'wow', text: 'Ker smo izmerili vsak kilovat toplote, preden bi ga izgubili.' },
      { who: 'narrator', text: 'Na zaslonu toplarne utripne naslov: Center, stara razdelilna postaja, omara Š-0.' },
      { who: 'genko', mood: 'worried', text: 'Tam je. Kjer se je vse začelo.' },
      { who: 'dark', mood: 'fleeing', text: 'Pridi. A najprej boš moral rešiti bolnišnico. Tam alarmi ne čakajo.' },
      { who: 'narrator', text: 'Nadaljevanje sledi: Zdravstvo in Center Temnega števca.' },
    ],
  },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id);
export const sceneKey = (id: string) => `scene:${id}`;
