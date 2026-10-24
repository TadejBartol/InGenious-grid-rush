import { sceneById, sceneKey } from '../core/story';
import { store } from '../state/store';
import { nav } from './nav';

/** Plays a story scene once (or again when `force`), then continues with `then`. */
export function playScene(id: string, then?: () => void, force = false) {
  const scene = sceneById(id);
  const seen = store.getState().seenTips.includes(sceneKey(id));
  if (!scene || (seen && !force)) {
    then?.();
    return;
  }
  store.getState().markTip(sceneKey(id));
  nav.setState({ scene: { id, then } });
}

export function endScene() {
  const s = nav.getState().scene;
  nav.setState({ scene: null });
  s?.then?.();
}
