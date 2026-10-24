/**
 * The story: who is the Dark Meter? Every region peels off one layer of the
 * mystery of "Š-0", the first meter of the old grid that nobody read again.
 */
export type Speaker = 'genko' | 'dark' | 'narrator';
export type StoryMood = 'happy' | 'smug' | 'worried' | 'wow' | 'smirk' | 'angry' | 'hurt' | 'fleeing';

/** Stage effects fired when a line appears. */
export type StoryFx = 'zap' | 'light' | 'flash';

export interface StoryLine {
  who: Speaker;
  mood?: StoryMood;
  text: string;
  fx?: StoryFx;
}

export interface Scene {
  id: string;
  title: string;
  /** Background mood: dark = the villain's turf, dawn = after a victory, lit = a facility comes online. */
  tone: 'dark' | 'boss' | 'dawn' | 'lit';
  /** Facility shown centre stage; it lights up on the first `light` line. */
  facility?: string;
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
    id: 'fac-livarna',
    title: 'Livarna se prižge',
    tone: 'lit',
    facility: 'livarna',
    lines: [
      { who: 'narrator', text: 'Livarna. Indukcijske peči so prvič pod nadzorom. Trije merilniki, en prehod, nič več ugibanja.' },
      { who: 'genko', mood: 'wow', text: 'Poglej graf! Peč vleče 160 kW, ko tali, in skoraj nič, ko čaka. Zdaj to končno vidimo.' },
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
      { who: 'genko', mood: 'worried', text: 'Ventilatorji po 40 kW pihajo v prazno halo. Ob nedeljah. Že leta.' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Urnik vklopa in podštevec. Peskalnica je osvetljena!' },
      { who: 'dark', mood: 'angry', text: 'Moji ventilatorji! Kompresorji ti tega ne bodo odpustili.' },
      { who: 'narrator', text: 'Na podštevcu je star plombirni žig. Komaj berljivo: »Š-«. Ostalo je odrgnjeno.' },
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
    id: 'r1-taunt',
    title: 'Temni števec se smeji',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Že konec? Kompresorji so komaj začeli piskati.' },
      { who: 'genko', mood: 'worried', text: 'Prva faza je priklop. Če ne povežem vseh merilnikov, v drugi lovim konico na slepo.' },
      { who: 'genko', mood: 'smug', text: 'Še enkrat. Tokrat vem, kje so pasti.' },
    ],
  },
  {
    id: 'r1-ko',
    title: 'Boss · Udar podatkov',
    tone: 'boss',
    facility: 'kompresorji',
    lines: [
      { who: 'narrator', text: 'Zadnji podatek priteče v oblak. Graf se izriše do konca.' },
      { who: 'genko', mood: 'smug', text: 'Vidim te, Temni števec. Vsak sunek, vsako noč, vsak kWh.' },
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
    id: 'fac-hladilnica',
    title: 'Hladilnica se prižge',
    tone: 'lit',
    facility: 'hladilnica',
    lines: [
      { who: 'narrator', text: 'Hladilnica. Štiri stopinje v komorah in kilovatne ure, ki jih nihče ne šteje.' },
      { who: 'genko', mood: 'worried', text: 'Vrata komore B so bila včeraj odprta 40 minut. Agregat je delal kot nor.' },
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
      { who: 'genko', mood: 'smug', text: 'Če pasterizacijo zamaknemo za deset minut, se konici ne srečata.' },
      { who: 'narrator', fx: 'light', text: 'Pakirnica se osvetli. Linije tečejo v ritmu.' },
      { who: 'dark', mood: 'hurt', text: 'Ritem … sovražim ritem.' },
      { who: 'narrator', text: 'V arhivu pakirnice leži shema elektro omare iz leta 1987. V kotu je narisan števec z oznako Š-0.' },
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
    id: 'r2-taunt',
    title: 'Lažnivec se smeji',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Iskal si lažnivca, našel pa si samo svojo napako.' },
      { who: 'genko', mood: 'worried', text: 'Faze si sledijo brez odmora. Najprej priklop, nato detektiv. Tokrat bom pazil na hitrost vtičnic.' },
    ],
  },
  {
    id: 'r2-ko',
    title: 'Boss · Trinajsti števec',
    tone: 'boss',
    facility: 'trafo',
    lines: [
      { who: 'narrator', text: 'Dvanajst števcev. Vsota se končno ujema do zadnjega kilovata.' },
      { who: 'genko', mood: 'smug', text: 'Ti si trinajsti, kajne? Tisti, ki ga ni na nobeni shemi.' },
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
    id: 'fac-vodarna',
    title: 'Vodarna se prižge',
    tone: 'lit',
    facility: 'vodarna',
    lines: [
      { who: 'narrator', text: 'Vodarna. Vodohran nad mestom in sto vodomerov, ki šepetajo po radiu.' },
      { who: 'genko', mood: 'happy', text: 'Vsak vodomer pošlje paket vsakih nekaj minut. Moramo jih samo slišati.' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Prehodi na strehah, repetitorji na drogovih. Slišim vse!' },
      { who: 'dark', mood: 'smirk', text: 'Slišiš vodo. Mene ne.' },
      { who: 'narrator', text: 'Med paketi se pojavi tuj. Brez naslova. Samo dva znaka: Š-0.' },
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
    lines: [
      { who: 'narrator', text: 'Čistilna naprava. Vsa puhala hkrati na polno. Vsi radijski števci utihnili.' },
      { who: 'dark', mood: 'angry', text: 'Brez podatkov ne veš, koliko zraka rabijo bakterije. Zato pihaš na polno. Zame.' },
      { who: 'genko', mood: 'worried', text: 'Najprej radijsko omrežje, potem konica. Ko vodomeri spet govorijo, puhala vodimo po resnici.' },
    ],
  },
  {
    id: 'r3-taunt',
    title: 'Tišina na frekvenci',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Tišina. Moja najljubša frekvenca, sem ti rekel.' },
      { who: 'genko', mood: 'worried', text: 'Kjer ni signala, ni podatka. Najprej omrežje, potem konica. Še enkrat.' },
    ],
  },
  {
    id: 'r3-ko',
    title: 'Boss · Naliv',
    tone: 'boss',
    facility: 'crpalisce',
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
    id: 'fac-toplarna',
    title: 'Toplarna se prižge',
    tone: 'lit',
    facility: 'toplarna',
    lines: [
      { who: 'narrator', text: 'Toplarna. Plinski motor, ki ga je nekdo nastavil tako, da teče tudi takrat, ko je elektrika poceni.' },
      { who: 'genko', mood: 'worried', text: 'Ob treh zjutraj prodajamo elektriko po ceni, ki ne pokrije niti plina.' },
      { who: 'genko', mood: 'smug', fx: 'light', text: 'Vozni red po ceni in hranilnik toplote. Motor teče, ko se splača.' },
      { who: 'dark', mood: 'smirk', text: 'Zima je dolga, robotek.' },
    ],
  },
  {
    id: 'fac-bolnisnicni',
    title: 'Bolnišnični CHP se prižge',
    tone: 'lit',
    facility: 'bolnisnicni',
    lines: [
      { who: 'narrator', text: 'Bolnišnični CHP. Tu toplota ne sme zmanjkati niti za minuto.' },
      { who: 'genko', mood: 'worried', text: 'Operacijske dvorane, porodnišnica, sterilizacija. Vse visi na eni enoti.' },
      { who: 'genko', mood: 'wow', fx: 'light', text: 'Rezervni načrt, alarmi in napoved odjema. Bolnišnica je na varnem.' },
      { who: 'dark', mood: 'hurt', text: 'Bolnišnica … ta odvod sem nekoč štel jaz.' },
      { who: 'narrator', text: 'Na stari omari v kleti visi zarjavela tablica: »Napajanje iz Centra, odvod Š-0«.' },
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
    id: 'r4-taunt',
    title: 'Zmrzal se smeji',
    tone: 'boss',
    lines: [
      { who: 'dark', mood: 'smirk', text: 'Zebe? Mene nikoli.' },
      { who: 'genko', mood: 'worried', text: 'Najprej poveži, potem vozi motor po ceni. Hranilnik je moj zaveznik. Gremo še enkrat.' },
    ],
  },
  {
    id: 'r4-ko',
    title: 'Boss · Topla zanka',
    tone: 'boss',
    facility: 'daljinsko',
    lines: [
      { who: 'narrator', text: 'Minus petnajst. Obe enoti tečeta, hranilnik je poln, radiatorji so topli.' },
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
    lines: [
      { who: 'narrator', text: 'Zora nad toplarno. Dimnik se kadi mirno in enakomerno.' },
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
