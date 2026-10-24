/** Hooks for automated playtests (enabled with ?e2e in the URL). Never used by the game itself. */
export const E2E = typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e');

export function expose(name: string, value: unknown) {
  if (E2E) (window as unknown as Record<string, unknown>)[`__gr_${name}`] = value;
}
