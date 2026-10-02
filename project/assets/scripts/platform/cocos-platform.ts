import { game, Game, sys } from 'cc';
import { KeyValueStore } from './contracts';

export const cocosStorage: KeyValueStore = {
  getItem: key => sys.localStorage.getItem(key),
  setItem: (key, value) => sys.localStorage.setItem(key, value),
};

export function subscribeLifecycle(hide: () => void, show: () => void): () => void {
  game.on(Game.EVENT_HIDE, hide);
  game.on(Game.EVENT_SHOW, show);
  return () => { game.off(Game.EVENT_HIDE, hide); game.off(Game.EVENT_SHOW, show); };
}
