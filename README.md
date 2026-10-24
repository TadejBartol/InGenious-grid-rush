# InGenious Grid Rush

Mobilna PWA igra, v kateri igralec zgradi energetski nadzorni center: priklaplja merilnike, lovi konice v živih podatkih in z vsakim prihranjenim kWh sestradá **Temni števec**. Vsaka mehanika je preoblečena funkcija platforme InGenious (zajem podatkov, spremljanje moči, analize, napovedi).

Igra deluje brez povezave, se namesti na domači zaslon in nima backenda: napredek je shranjen v IndexedDB na napravi.

## Kaj je v igri

| Področje | Vsebina |
| --- | --- |
| Regije | **1. Industrijska cona** (boss »Postaja, ki piska ponoči«), **2. Mlekarna in prehrana** (boss »Lažnivec na TP«), **3. Komunala** (boss »Čistilna, ki diha«) in **4. Kogeneracija** (boss »Zimska špica«), vsaka z 10 stopnjami na vijugasti poti z objekti ob njej. Regiji 5–6 sta na zemljevidu napovedani. |
| Mini igre | **Priklop** (logična uganka s potmi: poveži vsak merilnik z vtičnico iste barve, kabli se ne smejo križati in morajo zapolniti vsa polja; vsaka plošča ima natanko eno rešitev; nato nastavi Modbus naslov in hitrost), **Lov na konico** (drži obračunsko moč pod rdečo črto, ne da bi ustavil proizvodnjo; stolp porabe v barvah porabnikov pokaže, kdo koliko vleče, kartica pa, ali vklop še gre pod mejo), **Detektiv** (tapni odstopanje od pasu tipičnega tedna, nato v upočasnjenem času izberi vzrok med tremi vzorci; dogodki na urniku so načrtovani in niso anomalije; hitra najdba in combo prineseta dodatne DP), **Radijsko omrežje** (postavi wM-Bus prehode in repetitorje, da vsi vodomeri slišijo signal), **Kogenerator** (vodi motor in hranilnik toplote po ceni elektrike in odjemu, drži omrežje toplo in izkoristek visok). |
| Napredovanje | 1–3 zvezdice na stopnjo s prikazom »skoraj-zmage«, valute kWh / DP / InGenious čipi, osvetljevanje objektov, idle števec (tudi ko je igra zaprta, do 8–16 h), nadgradnje objektov (vsaka stopnja 70 % dražja), drevo 8 raziskav (poznejše se odklenejo z regijami), regija, ki jo lahko odkleneš, na zemljevidu utripa, značka na zavihku Nadgradnje, ko si kaj lahko privoščiš, nagrada vidna že pred stopnjo, kartice naprav, kozmetika za robotka InGenious, zlati robotek InGenious za popolno regijo. |
| Zgodba | 28 filmskih prizorov (»Skrivnost Š-0«): uvod v regijo, osvetlitev vsake zgradbe, boss, posmeh ob porazu, udarec bossa (KO) in zmaga. Kamera se nagiba k govorcu, strele, bliski, zgradba se prižge na odru, samodejno predvajanje ali tap. Videni prizori so v Zbirki. |
| Govor | Vsaka replika ima lahko posnet glas (`public/voice/`). InGenious dobi robotski, Temni števec pa hrapav odmevajoč filter. Brez posnetkov bere slovenski glas naprave, če ga ima. Nastavitev »Glas v zgodbi«. |
| Boss in zmaga | Po vsaki stopnji kratka bitka: InGenious prileti, udari s strelo in Temni števec izžene iz objekta (ob porazu se ta zaščiti in ostane). Boss stopnja ima svoj videz na poti, opozorilni uvod in oznako faze med igro. Po prvi zmagi sledi zaslon »Boss premagan« z osvetljevanjem objektov regije, štetjem nagrad in nadaljevanjem zgodbe. |
| Nadgradnje | Nadzorna soba (izberi objekt, drži gumb za hitro optimizacijo, mejniki na 5 in 10) in Laboratorij (vezje raziskav okoli jedra InGenious). Dotik kWh, DP, čipov ali niza odpre razlago, kaj je to in kako se pridobi. |
| Dnevna zanka | Dnevni izziv (enak za vse, deljenje rezultata kot emoji graf), niz dni z enim zamrzovalnikom na teden. Odklene se z bossom regije 1. |
| Glasba | Štiri skladbe, ki jih v živo igra mali WebAudio bend (bobni, bas, pad, arpeggio, melodija, odmev, reverb, sidechain), nič prenosov: »Svetla mreža« v menijih dobi nov sloj z vsakim osvetljenim objektom, »Konica« pod stopnjami se zgosti in pospeši s pritiskom, »Temni števec« za boss boje in »Za zaveso« pod prizori. |
| Občutek | Sintetiziran zvok (WebAudio, nič prenosov), delci, tresenje, upočasnitev v zadnjih sekundah, vibracije na Androidu, »Manj animacij« za dostopnost. |
| Etika | Brez nakupov, brez oglasov, brez čakalnih zidov, brez obvestil. |

## Zagon

Potrebuješ Node.js 20.19+ (priporočeno 22).

```bash
npm install
npm run dev        # razvojni strežnik na http://localhost:5173
npm test           # enotni testi in testi balansa
npm run build      # produkcijski build v dist/
npm run preview    # predogled builda (vključno s service workerjem)
```

### Avtomatski playtest

`scripts/e2e.mjs` odigra igro v Chromiumu na telefonskem zaslonu z resničnim vnosom (vlečenje kablov, tapi), preveri zvezdice, nakup nadgradnje, shranjevanje po osvežitvi, prihranek v odsotnosti, odklep regij 2–4, Detektiva, Radijsko omrežje, Kogenerator (prek pravih drsnikov) in dnevni izziv ter shrani posnetke zaslona v `playtest/`.

```bash
npm i -D playwright && npx playwright install chromium   # enkrat
npm run build && npx vite preview --port 4173 &
npm run e2e
```

Testni dostop do notranjosti igre je vklopljen samo z `?e2e` v URL-ju.

## Objava na GitHub Pages

Repozitorij že vsebuje workflow `.github/workflows/deploy.yml`, ki ob vsakem pushu na `main` požene teste, zgradi igro in jo objavi.

1. GitHub Pages za zasebne repozitorije zahteva plačljiv paket, zato repozitorij nastavi kot javnega (**Settings → General → Danger Zone → Change visibility**). Dokler je zaseben, workflow samo testira in zgradi igro.
2. Odpri **Settings → Pages** in pod **Build and deployment → Source** izberi **GitHub Actions**.
3. V zavihku **Actions** ponovno poženi »Test in objava« (ali pushaj na `main`).
4. Igra bo na voljo na `https://tadejbartol.github.io/InGenious-grid-rush/`.

Če želiš, da koda ostane zasebna, uporabi drugo gostovanje (Netlify, Vercel, Cloudflare Pages): build ukaz `npm run build`, izhodna mapa `dist`, `BASE_PATH` ni potreben.

Na telefonu odpri povezavo in izberi **Dodaj na domači zaslon**. Igra po prvem nalaganju deluje brez povezave; ko izide nova različica, se pokaže gumb **Posodobi**.

## Merjenje retencije (test z 20 sodelavci)

Igra lokalno beleži dogodke `session_start`, `session_end`, `level_start`, `level_end`, `daily_end`. Vsak igralec jih v **Nastavitve → Izvozi analitiko (JSON)** izvozi in pošlje; iz datumov sej se izračuna D1/D7.

Če nastaviš spremenljivko `VITE_ANALYTICS_URL` (npr. preprost endpoint ali Google Apps Script), igra dogodke dodatno pošilja z `navigator.sendBeacon` skupaj z anonimnim ID-jem naprave.

## Prilagajanje

- **Barve znamke InGenious:** `src/styles.css` (`--brand`, `--brand-2`) in `COLORS` v `src/games/shared/pixi.ts`.
- **Stopnje in ekonomija:** `src/core/levels.ts` in `src/core/balance.ts`. Po spremembi meja pri Lovu na konico poženi `npm test`: test balansa preveri, da je vsaka stopnja brez ukrepanja izgubljena in z razumnim igranjem rešljiva.
- **Replike robotka InGenious:** `src/core/genko.ts`.
- **Zgodba:** `src/core/story.ts` (prizori in replike).
- **Glasovi:** v repozitorij dodaj skrivnosti `AZURE_SPEECH_KEY` in `AZURE_SPEECH_REGION` (brezplačni Azure Speech F0 zadošča), akcija *Glasovi zgodbe* se nato sama zažene ob vsaki spremembi zgodbe (ali ročno v Actions). Posnetki se shranijo v `public/voice/`. Lokalno: `AZURE_SPEECH_KEY=… node scripts/voice.mjs`. Lastne posnetke poimenuj `<prizor>.<vrstica>.mp3` (npr. `r1-intro.0.mp3`) in poženi `node scripts/voice.mjs --scan`. Ko spremeniš besedilo replike, se njen stari posnetek ne predvaja več, dokler ga ne generiraš znova.
- **Demo podatki:** glej [docs/DEMO-PODATKI.md](docs/DEMO-PODATKI.md).

## Arhitektura

```
src/
  core/        čista logika: tipi, stopnje, ekonomija, dnevni izziv, RNG
  games/       mini igre: logic.ts (deterministična, testirana) + *View.tsx (PixiJS izris)
  state/       Zustand store, shema shranjevanja z migracijo, IndexedDB
  audio/       WebAudio sintetizator in haptika
  ui/          Preact zasloni in komponente
  data/        tedenski profili porabe
tests/         Vitest: generatorji ugank, simulacija, balans z botom, napredek, shranjevanje
scripts/       playtest in generiranje ikon
```

Sklad: Vite + TypeScript, PixiJS 8 (WebGL), Preact, Zustand, idb, vite-plugin-pwa (Workbox). Prvi prenos je približno 220 KB (gzip).

Odstopanje od scenarija: namesto Howler.js in zvočne sprite datoteke je zvok sintetiziran v brskalniku. Tako ni nobenega zvočnega prenosa in igra ostane pod ciljnimi 2 MB.

## Naslednji koraki (po scenariju)

- **Beta:** backend (Supabase) za lige in ekipne izzive, preverjanje rezultatov dnevnega izziva na strežniku s ponovitvijo semena, Web Push opomnik za niz.
- **Lansiranje:** regiji 5–6 (Alarm!, Selitev, finale s Temnim števcem v treh fazah), prestiž, demo način z resničnimi podatki iz InGenious.
