# InGenious Grid Rush

Mobilna PWA igra, v kateri igralec zgradi energetski nadzorni center: priklaplja merilnike, lovi konice v živih podatkih in z vsakim prihranjenim kWh sestradá **Temni števec**. Vsaka mehanika je preoblečena funkcija platforme InGenious (zajem podatkov, spremljanje moči, analize, napovedi).

Igra deluje brez povezave, se namesti na domači zaslon in nima backenda: napredek je shranjen v IndexedDB na napravi.

## Kaj je v igri

| Področje | Vsebina |
| --- | --- |
| Regiji | **1. Industrijska cona** (10 stopenj, boss »Postaja, ki piska ponoči«) in **2. Mlekarna in prehrana** (10 stopenj, boss »Lažnivec na TP«). Regije 3–6 so na zemljevidu napovedane. |
| Mini igre | **Priklop** (vleci kable od merilnikov do prehoda, nastavi Modbus naslov in hitrost), **Lov na konico** (drži obračunsko moč pod rdečo črto, ne da bi ustavil proizvodnjo), **Detektiv** (najdi anomalije v tednu podatkov, combo podvoji DP). |
| Napredovanje | 1–3 zvezdice na stopnjo s prikazom »skoraj-zmage«, valute kWh / DP / Genko čipi, osvetljevanje objektov, idle števec (tudi ko je igra zaprta, do 8–16 h), nadgradnje objektov, drevo raziskav, kartice naprav, kozmetika za Genka, zlati Genko za popolno regijo. |
| Dnevna zanka | Dnevni izziv (enak za vse, deljenje rezultata kot emoji graf), niz dni z enim zamrzovalnikom na teden. Odklene se z bossom regije 1. |
| Občutek | Sintetiziran zvok (WebAudio, nič prenosov), ambient, ki je bolj harmoničen z več osvetljenimi objekti, BPM, ki pospešuje med Lovom na konico, delci, tresenje, upočasnitev v zadnjih sekundah, vibracije na Androidu, »Manj animacij« za dostopnost. |
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

`scripts/e2e.mjs` odigra igro v Chromiumu na telefonskem zaslonu z resničnim vnosom (vlečenje kablov, tapi), preveri zvezdice, nakup nadgradnje, shranjevanje po osvežitvi, prihranek v odsotnosti, odklep regije 2, Detektiva in dnevni izziv ter shrani posnetke zaslona v `playtest/`.

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
- **Genkove replike:** `src/core/genko.ts`.
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

- **Beta:** backend (Supabase) za lige in ekipne izzive, preverjanje rezultatov dnevnega izziva na strežniku s ponovitvijo semena, Web Push opomnik za niz, regiji 3–4 (wM-Bus Priklop, Kogenerator).
- **Lansiranje:** regiji 5–6 (Alarm!, Selitev, finale s Temnim števcem v treh fazah), prestiž, demo način z resničnimi podatki iz InGenious.
