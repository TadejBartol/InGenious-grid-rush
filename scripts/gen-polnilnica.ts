// Precomputes Polnilnica boards for every level, so the game never runs the slow search at start.
// Run from the repo root: npx esbuild scripts/gen-polnilnica.ts --bundle --platform=node --format=esm --outfile=/tmp/gen-polnilnica.mjs && node /tmp/gen-polnilnica.mjs
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/core/levels';
import { generatePuzzle } from '../src/games/polnilnica/logic';
import type { PolnilnicaParams } from '../src/core/types';

const out: Record<string, unknown> = {};
for (const l of LEVELS)
  for (const st of l.stages) {
    if (st.kind !== 'polnilnica') continue;
    const p = st.params as PolnilnicaParams;
    const t0 = Date.now();
    const pz = generatePuzzle(p, 20000);
    out[p.seed] = { lot: { ...pz.lot, limitKw: Number.isFinite(pz.lot.limitKw) ? pz.lot.limitKw : null }, start: pz.start, par: pz.solution.length };
    console.log(l.id, 'moves', pz.solution.length, `${Date.now() - t0} ms`);
  }
writeFileSync('src/games/polnilnica/boards.json', JSON.stringify(out) + '\n');
