# Demo podatki

Mini igra **Detektiv** in grafi v igri uporabljajo tedenske profile porabe iz `src/data/profiles.ts`. To so **sintetični profili**, modelirani po tipičnih slovenskih industrijskih objektih. Ne vsebujejo nobenih podatkov strank, zato jih je varno objaviti.

| Profil | Model |
| --- | --- |
| `livarna` | Dve izmeni (6:00–22:00), odmor ob 12:00 in 18:00, sobota dopoldne skrajšano, nedelja bazna obremenitev. Vrh ~820 kW, noč ~120 kW. |
| `mlekarna` | Hlajenje 24/7 z dnevnim nihanjem (vroče popoldne), predelava 5:00–15:00, sobota delno. |
| `trafo` | Vsota pisarn (7:00–16:00) in proizvodnje (6:00–22:00) na eni transformatorski postaji. |

Vsak dan dobi naključni faktor ±6 %, nad tem je šum, določen s stopnjo. Anomalije (nočna poraba, puščanje zraka čez vikend, prazni tek kompresorja, konica, odprta hladilnica) se vstavijo na podlagi semena stopnje, zato je vsaka stopnja vedno enaka.

## Zamenjava z resničnimi podatki iz InGenious (faza 2)

Za »demo način« z resničnimi krivuljami je dovolj izvoz enega tedna urnih povprečij moči:

```csv
timestamp,kw
2026-03-02T00:00:00+01:00,118.4
2026-03-02T01:00:00+01:00,121.0
...
```

- 168 vrstic (ponedeljek 00:00 do nedelje 23:00), lokalni čas.
- Anonimizacija: brez imena lokacije in števca. Vrednosti lahko pomnožiš s skrivnim faktorjem (npr. 0,8–1,2), da absolutna raven ne razkrije stranke.
- »Tipičen teden« za primerjavo je povprečje istega tedna v 4–8 tednih pred tem.
- Anomalije označi ročno (začetek, trajanje, vrsta) ali jih zazna obstoječa analiza v InGenious.

Takšen CSV se pretvori v obliko `{ normal: number[], actual: number[], anomalies: [...] }` (glej `Dataset` v `src/games/detektiv/logic.ts`) in nadomesti `generateDataset` za izbrane stopnje.
