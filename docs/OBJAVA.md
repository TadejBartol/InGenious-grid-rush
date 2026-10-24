# Objava igre InGenious Grid Rush

Igra je statična PWA: `npm run build` naredi mapo `dist/`, ki jo lahko gosti katerikoli statični strežnik. Backend ni potreben, napredek je shranjen na napravi igralca.

## 1. Izberi gostovanje

### A. GitHub Pages (najmanj dela, repozitorij mora biti javen)

Workflow `.github/workflows/deploy.yml` ob vsakem pushu na `main` požene teste, zgradi igro in jo objavi.

1. **Settings → General → Danger Zone → Change visibility → Public.** Pages za zasebne repozitorije zahteva plačljiv GitHub paket. Skrivnosti (npr. ključ za glasove) ostanejo skrite tudi v javnem repozitoriju.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions → Test in objava → Run workflow** (veja `main`).
4. Igra je na `https://tadejbartol.github.io/InGenious-grid-rush/`.

### B. Cloudflare Pages (koda ostane zasebna, brezplačno)

1. Na [dash.cloudflare.com](https://dash.cloudflare.com) odpri **Workers & Pages → Create → Pages → Connect to Git** in izberi repozitorij.
2. Nastavitve builda:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
3. **Save and Deploy.** Igra dobi naslov `https://<ime>.pages.dev`, vsak push na `main` jo posodobi.

Netlify in Vercel delujeta enako (build `npm run build`, mapa `dist`, Node 22). `BASE_PATH` pri njih ni potreben.

## 2. Lastna domena (priporočeno)

Na primer `igra.ingenious.si`:

1. Pri gostovanju dodaj domeno (GitHub: **Settings → Pages → Custom domain**, Cloudflare: **Custom domains**).
2. Pri ponudniku DNS dodaj zapis `CNAME igra → tadejbartol.github.io` (oz. naslov `*.pages.dev`).
3. Vklopi **Enforce HTTPS**. PWA brez HTTPS ne deluje.
4. Pri GitHub Pages z lastno domeno v workflowu nastavi `BASE_PATH: /`, ker igra potem teče v korenu domene.

Lastna domena je potrebna tudi za Google Play (glej spodaj), ker mora biti datoteka `/.well-known/assetlinks.json` v korenu domene.

## 3. Namestitev na telefon

- **Android (Chrome):** odpri povezavo, izberi **Namesti aplikacijo**. Igra dobi ikono, celozaslonski način in deluje brez povezave.
- **iPhone (Safari):** **Deli → Dodaj na začetni zaslon.**
- Ko objaviš novo različico, igralci ob naslednjem zagonu vidijo gumb **Posodobi**.

## 4. Google Play (neobvezno)

PWA se zapakira kot Trusted Web Activity, igra pa se še vedno nalaga z interneta in se posodablja sama.

1. Na [pwabuilder.com](https://www.pwabuilder.com) vpiši naslov igre, izberi **Package for stores → Android**.
2. Package ID npr. `si.ingenious.gridrush`. Prenesi paket, v njem sta `.aab` in `assetlinks.json`.
3. `assetlinks.json` shrani v repozitorij kot `public/.well-known/assetlinks.json` in pushaj, da je dosegljiv na `https://<tvoja-domena>/.well-known/assetlinks.json`.
4. V [Google Play Console](https://play.google.com/console) (enkratna pristojbina 25 USD) ustvari aplikacijo in naloži `.aab`. Posnetki zaslona za trgovino so v `public/screenshots/`, ikona v `public/icons/icon-512.png`.
5. Nov osebni račun mora pred javno objavo opraviti zaprto testiranje z vsaj 12 testerji 14 dni. Za to je primeren tudi interni test s sodelavci.

App Store je zahtevnejši: potrebuješ Mac z Xcode, Apple Developer račun (99 USD na leto), Apple pa ovite spletne aplikacije pogosto zavrne. Za iPhone je namestitev prek Safarija dovolj.

## 5. Pred javno objavo

- Igro odigraj na vsaj enem Androidu in enem iPhonu (zvok, vibracije, namestitev, igranje brez povezave).
- Če želiš meriti retencijo, nastavi spremenljivko `VITE_ANALYTICS_URL` pri gostovanju (glej README).
- Ko spremeniš besedila zgodbe, akcija *Glasovi zgodbe* sama posname nove glasove in jih doda v repozitorij.
- Povezava za deljenje ima predogled (`public/screenshots/og.jpg`). Ko imaš končno domeno, v `index.html` vpiši poln naslov slike, npr. `https://igra.ingenious.si/screenshots/og.jpg`, ker nekatera omrežja relativnega ne preberejo.
