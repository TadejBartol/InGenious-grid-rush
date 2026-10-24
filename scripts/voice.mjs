// Generates spoken story lines into public/voice/ and writes public/voice/manifest.json.
//
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node scripts/voice.mjs
//       synthesises every line that has no clip yet or whose text changed
//       (Azure neural voices sl-SI-PetraNeural and sl-SI-RokNeural).
//   node scripts/voice.mjs --scan
//       only rebuilds the manifest from files already in public/voice/, for example
//       your own recordings named <scene>.<line>.mp3 (r1-intro.0.mp3, r1-intro.1.mp3 ...).
//
// The game plays a clip only while its recorded text still matches the line in
// src/core/story.ts, so edited dialogue falls back to silence until it is regenerated.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SCENES } from '../src/core/story.ts';

const DIR = new URL('../public/voice/', import.meta.url);
const MANIFEST = new URL('manifest.json', DIR);
mkdirSync(DIR, { recursive: true });

/** Voice casting. InGenious and the Dark Meter also get a character filter in the game. */
const CAST = {
  genko: { voice: 'sl-SI-PetraNeural', pitch: '+14%', rate: '+6%' },
  dark: { voice: 'sl-SI-RokNeural', pitch: '-22%', rate: '-12%' },
  narrator: { voice: 'sl-SI-RokNeural', pitch: '-4%', rate: '-6%' },
};

/** Bump when the casting or SSML changes, so every line is synthesised again. */
const VERSION = 2;
const scan = process.argv.includes('--scan');
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION ?? 'westeurope';
if (!scan && !key) {
  console.error('Manjka AZURE_SPEECH_KEY. Za samo posodobitev manifesta poženi z --scan.');
  process.exit(1);
}

const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const manifest = {};
const escape = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function synth(text, who) {
  const c = CAST[who];
  // Tight silences keep the cutscene snappy: Azure otherwise pads about a second per sentence.
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="sl-SI">` +
    `<voice name="${c.voice}"><mstts:silence type="Leading-exact" value="40ms"/><mstts:silence type="Tailing-exact" value="120ms"/>` +
    `<mstts:silence type="Sentenceboundary-exact" value="${who === 'dark' ? 420 : 300}ms"/>` +
    `<prosody pitch="${c.pitch}" rate="${c.rate}">${escape(text)}</prosody></voice></speak>`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'ingenious-grid-rush',
      },
      body: ssml,
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status !== 429 && r.status < 500) throw new Error(`Azure ${r.status}: ${await r.text()}`);
    await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
  }
  throw new Error('Azure ni odgovoril.');
}

let made = 0;
let kept = 0;
for (const scene of SCENES) {
  for (const [i, line] of scene.lines.entries()) {
    const id = `${scene.id}.${i}`;
    const file = `${id}.mp3`;
    const path = new URL(file, DIR);
    const fresh = existsSync(path) && (scan || (old[id]?.text === line.text && old[id]?.v === VERSION));
    if (fresh) {
      manifest[id] = { file, text: line.text, v: old[id]?.v ?? VERSION };
      kept++;
      continue;
    }
    if (scan) continue;
    writeFileSync(path, await synth(line.text, line.who));
    manifest[id] = { file, text: line.text, v: VERSION };
    made++;
    process.stdout.write('.');
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
console.log(`\nGlasovi: ${made} novih, ${kept} obstoječih, ${Object.keys(manifest).length} v manifestu.`);
