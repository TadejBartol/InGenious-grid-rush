import { useRef } from 'preact/hooks';

/** Restartable CSS screen shake that never remounts the canvas underneath. */
export function useShake(reduced: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const shake = () => {
    const el = ref.current;
    if (!el || reduced) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  };
  return [ref, shake] as const;
}
