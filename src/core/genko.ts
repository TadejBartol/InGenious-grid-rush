/** Genko's voice: dry, data-obsessed, never mean to the player. */
export const GENKO = {
  welcome: [
    'Živjo, novi inženir. Jaz sem InGenious, tvoj robotek za podatke. Grafe imam rad bolj kot ljudi, ampak zate bom naredil izjemo.',
    'Tam zunaj živi Temni števec. Hrani se z energijo, ki jo tovarne zapravijo – ponoči, v konicah, v puščajočih ceveh.',
    'Edino, česar ne prenese, je svetloba podatkov. Priklopi merilnike, ulovi potratnost in ga sestradaj.',
  ],
  fail: [
    'Brez podatkov si samo še en človek z mnenjem.',
    'Graf ne laže. Ti si se pa malo zmotil.',
    'Temni števec se smeji. Jaz ne. Še enkrat?',
    'Skoraj. In »skoraj« na računu za elektriko ni popust.',
  ],
  win: [
    'Čestitam. Temni števec je ravno izgubil kosilo.',
    'Lepa krivulja. Skoraj sem se razjokal. Skoraj.',
    'To je bilo tako učinkovito, da sem si shranil posnetek.',
    'Še nekaj takih in bo Temni števec moral na dieto.',
  ],
  perfect: ['Tri zvezdice. Uradno si moj najljubši človek ta teden.', 'Brez napake. Zapisal sem v dnevnik. Z velikimi črkami.'],
  idle: [
    'Osvetljeni objekti varčujejo tudi, ko spiš. Jaz ne spim. Jaz štejem.',
    'Vsak kWh na števcu je kWh, ki ga Temni števec ne bo pojedel.',
    'Nadgradi objekte in števec bo tekel hitreje. Matematika je lepa.',
  ],
  spark: ['Iskra! Naslov ali hitrost ne štimata.', 'Ta merilnik govori drug jezik. Preveri baud.', 'Dva z istim naslovom? Na vodilu se kregata.'],
  stall: ['Zastoj! Zaloga je prazna, proizvodnja stoji.', 'Brez zraka ni peskanja. Vklopi ga prej.'],
  peak: ['Konica! Nekaj izklopi, hitro!', 'Rdeča črta je rdeča z razlogom.'],
} as const;

export function pick<T>(lines: readonly T[], salt = Date.now()): T {
  return lines[Math.abs(Math.floor(salt)) % lines.length];
}
