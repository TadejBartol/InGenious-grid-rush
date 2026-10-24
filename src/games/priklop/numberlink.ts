import type { Rng } from '../../core/rng';

/**
 * Numberlink ("flow") boards: pairs of endpoints that must be joined by paths
 * which together fill every cell. Boards are built from a random Hamiltonian
 * path cut into segments, and kept only when the solver proves the solution unique.
 */

export interface Pair {
  a: number;
  b: number;
}

const neighbours = (cols: number, rows: number) => {
  const n: number[][] = [];
  for (let k = 0; k < cols * rows; k++) {
    const x = k % cols;
    const y = Math.floor(k / cols);
    const list: number[] = [];
    if (y > 0) list.push(k - cols);
    if (x < cols - 1) list.push(k + 1);
    if (y < rows - 1) list.push(k + cols);
    if (x > 0) list.push(k - 1);
    n.push(list);
  }
  return n;
};

/** Random Hamiltonian path over the grid, by backbite moves on a boustrophedon start. */
export function randomHamiltonian(cols: number, rows: number, rng: Rng, moves = cols * rows * 20): number[] {
  const nb = neighbours(cols, rows);
  let path: number[] = [];
  for (let y = 0; y < rows; y++) for (let i = 0; i < cols; i++) path.push(y * cols + (y % 2 ? cols - 1 - i : i));
  const pos = new Int32Array(cols * rows);
  const index = () => path.forEach((k, i) => (pos[k] = i));
  index();
  for (let m = 0; m < moves; m++) {
    if (rng.chance(0.5)) path.reverse(), index();
    // Backbite at the head: pick a neighbour of the end, reverse the tail after it.
    const end = path[path.length - 1];
    const options = nb[end].filter((k) => k !== path[path.length - 2]);
    const pick = options[Math.floor(rng.next() * options.length)];
    const i = pos[pick];
    path = path.slice(0, i + 1).concat(path.slice(i + 1).reverse());
    for (let j = i + 1; j < path.length; j++) pos[path[j]] = j;
  }
  return path;
}

/** Cuts a path into `count` segments of at least `minLen` cells. */
export function cutPath(path: number[], count: number, minLen: number, rng: Rng): number[][] | null {
  const total = path.length;
  if (count * minLen > total) return null;
  const extra = total - count * minLen;
  const weights = Array.from({ length: count }, () => rng.next() + 0.15);
  const sum = weights.reduce((a, b) => a + b, 0);
  const lens = weights.map((w) => minLen + Math.floor((w / sum) * extra));
  lens[lens.length - 1] += total - lens.reduce((a, b) => a + b, 0);
  const segments: number[][] = [];
  let at = 0;
  for (const len of lens) {
    segments.push(path.slice(at, at + len));
    at += len;
  }
  return segments;
}

/**
 * Counts solutions up to `limit`. Returns -1 if the search budget runs out,
 * which callers treat as "not provably unique".
 */
export function countSolutions(cols: number, rows: number, pairs: Pair[], limit = 2, budget = 200_000, found_out?: Int16Array[]): number {
  const nb = neighbours(cols, rows);
  const N = cols * rows;
  const owner = new Int16Array(N).fill(-1);
  const isEnd = new Int16Array(N).fill(-1);
  pairs.forEach((p, i) => {
    owner[p.a] = i;
    owner[p.b] = i;
    isEnd[p.b] = i;
  });
  const head = pairs.map((p) => p.a);
  const done = pairs.map(() => false);
  let found = 0;
  let nodes = 0;

  const free = (k: number) => owner[k] === -1;

  // Every empty cell needs two usable neighbours (empty, an active head, or an open target).
  const deadEnd = (k: number) => {
    let n = 0;
    for (const o of nb[k]) {
      if (owner[o] === -1) n++;
      else {
        const f = owner[o];
        if (!done[f] && (head[f] === o || pairs[f].b === o)) n++;
      }
    }
    return n < 2;
  };

  const flowOk = (): boolean => {
    // Region labelling of empty cells, then every open flow must link head→target
    // through one region, and every region must be enterable by some flow.
    const region = new Int32Array(N).fill(-1);
    let regions = 0;
    const stack: number[] = [];
    for (let s = 0; s < N; s++) {
      if (owner[s] !== -1 || region[s] !== -1) continue;
      region[s] = regions;
      stack.push(s);
      while (stack.length) {
        const k = stack.pop()!;
        for (const o of nb[k])
          if (owner[o] === -1 && region[o] === -1) {
            region[o] = regions;
            stack.push(o);
          }
      }
      regions++;
    }
    const regionUsed = new Uint8Array(regions);
    for (let f = 0; f < pairs.length; f++) {
      if (done[f]) continue;
      const h = head[f];
      const t = pairs[f].b;
      // Adjacent head and target: fine.
      if (nb[h].includes(t)) {
        for (const o of nb[h]) if (owner[o] === -1) regionUsed[region[o]] = 1;
        continue;
      }
      const rh = new Set<number>();
      for (const o of nb[h]) if (owner[o] === -1) rh.add(region[o]);
      let ok = false;
      for (const o of nb[t])
        if (owner[o] === -1 && rh.has(region[o])) {
          ok = true;
          regionUsed[region[o]] = 1;
        }
      if (!ok) return false;
    }
    for (let r = 0; r < regions; r++) if (!regionUsed[r]) return false;
    return true;
  };

  const search = (): void => {
    if (found >= limit || nodes > budget) return;
    nodes++;
    // Pick the open flow whose head has the fewest moves.
    let best = -1;
    let bestMoves: number[] = [];
    for (let f = 0; f < pairs.length; f++) {
      if (done[f]) continue;
      const moves = nb[head[f]].filter((o) => free(o) || o === pairs[f].b);
      if (moves.length === 0) return;
      if (best === -1 || moves.length < bestMoves.length) {
        best = f;
        bestMoves = moves;
        if (moves.length === 1) break;
      }
    }
    if (best === -1) {
      for (let k = 0; k < N; k++) if (owner[k] === -1) return;
      found++;
      found_out?.push(owner.slice());
      return;
    }
    const f = best;
    const prevHead = head[f];
    for (const m of bestMoves) {
      if (m === pairs[f].b) {
        done[f] = true;
        if (flowOk()) search();
        done[f] = false;
        continue;
      }
      owner[m] = f;
      head[f] = m;
      let ok = true;
      for (const o of nb[prevHead]) if (owner[o] === -1 && deadEnd(o)) ok = false;
      for (const o of nb[m]) if (ok && owner[o] === -1 && deadEnd(o)) ok = false;
      if (ok && flowOk()) search();
      owner[m] = -1;
      head[f] = prevHead;
      if (found >= limit || nodes > budget) return;
    }
  };

  if (!flowOk()) return 0;
  search();
  return nodes > budget ? -1 : found;
}

/**
 * A unique-solution board filling the whole grid. Starts from a random cut and,
 * while the solver finds another solution, splits a path where the two disagree:
 * the new endpoints pin the intended route.
 */
export function generateNumberlink(cols: number, rows: number, count: number, rng: Rng, maxCount = count + 2, tries = 200): number[][] | null {
  for (let t = 0; t < tries; t++) {
    const path = randomHamiltonian(cols, rows, rng);
    let segs = cutPath(path, Math.max(2, count - 1), 3, rng);
    if (!segs) return null;
    for (let round = 0; round < 12 && segs; round++) {
      if (segs.some((s) => adjacent(cols, s[0], s[s.length - 1]))) break;
      const sols: Int16Array[] = [];
      const n = countSolutions(cols, rows, segs.map((s) => ({ a: s[0], b: s[s.length - 1] })), 6, 200_000, sols);
      if (n === -1 || n === 0) break;
      const mine = new Int16Array(cols * rows);
      segs.forEach((sg, i) => sg.forEach((k) => (mine[k] = i)));
      // Routes that differ only inside one path's own cells fill the board the same way.
      const alt = sols.find((o) => o.some((v, k) => v !== mine[k]));
      if (!alt) {
        if (segs.length >= count && segs.length <= maxCount) return segs;
        break;
      }
      if (segs.length >= maxCount) break;
      segs = split(cols, segs, (k) => alt[k] !== mine[k], rng);
    }
  }
  return null;
}

/** Splits one path at a cell where the alternative solution disagrees. */
function split(cols: number, segs: number[][], differs: (k: number) => boolean, rng: Rng): number[][] | null {
  const options: [number, number][] = [];
  segs.forEach((sg, i) => {
    for (let j = 2; j <= sg.length - 3; j++) {
      if (!differs(sg[j]) && !differs(sg[j + 1])) continue;
      const a = sg.slice(0, j + 1);
      const b = sg.slice(j + 1);
      if (adjacent(cols, a[0], a[a.length - 1]) || adjacent(cols, b[0], b[b.length - 1])) continue;
      options.push([i, j]);
    }
  });
  if (!options.length) return null;
  const [i, j] = options[Math.floor(rng.next() * options.length)];
  const sg = segs[i];
  return [...segs.slice(0, i), sg.slice(0, j + 1), sg.slice(j + 1), ...segs.slice(i + 1)];
}

const adjacent = (cols: number, a: number, b: number) => {
  const ax = a % cols;
  const bx = b % cols;
  return (Math.abs(ax - bx) === 1 && Math.floor(a / cols) === Math.floor(b / cols)) || (ax === bx && Math.abs(a - b) === cols);
};
