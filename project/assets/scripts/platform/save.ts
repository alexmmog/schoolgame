import { QuizSession } from '../core/quiz';
import { KeyValueStore } from './contracts';

// Unique namespace; never reads or writes an existing game's save.
export const SAVE_KEY = 'cocos-mvp-validation-20261001.quiz.v1';
export function loadSession(storage: KeyValueStore): { session: QuizSession; warning?: string } {
  try { return { session: new QuizSession(storage.getItem(SAVE_KEY)) }; }
  catch { return { session: new QuizSession(), warning: '本地存档读取失败，当前为新进度。' }; }
}
export function saveSession(storage: KeyValueStore, session: QuizSession): string | undefined {
  try { storage.setItem(SAVE_KEY, session.serialize()); return undefined; }
  catch { return '本地存档写入失败；当前进度仅在本次运行中保留。'; }
}
