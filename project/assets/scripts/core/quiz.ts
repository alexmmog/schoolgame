import { BANK_REVISION, QUESTIONS, Question } from './questions';

export interface Answer { questionId: string; choiceId: string }
export interface SaveData {
  schema: 1;
  bankRevision: string;
  index: number;
  answers: Answer[];
  paused: boolean;
  rewardIds: string[];
}

function fresh(): SaveData {
  return { schema: 1, bankRevision: BANK_REVISION, index: 0, answers: [], paused: false, rewardIds: [] };
}

export class QuizSession {
  private state: SaveData = fresh();
  private hidden = false;
  private adPending = false;
  readonly restoreStatus: 'new' | 'restored' | 'invalid';

  constructor(saved?: string | null) {
    if (saved == null) { this.restoreStatus = 'new'; return; }
    try {
      const parsed: unknown = JSON.parse(saved);
      this.state = validateSave(parsed);
      this.restoreStatus = 'restored';
    } catch { this.restoreStatus = 'invalid'; }
  }

  get question(): Question | undefined { return QUESTIONS[this.state.index]; }
  get index(): number { return this.state.index; }
  get finished(): boolean { return this.state.index === QUESTIONS.length; }
  get paused(): boolean { return this.state.paused; }
  get blocked(): boolean { return this.paused || this.hidden || this.adPending; }
  get answer(): Answer | undefined { return this.state.answers[this.state.index]; }
  get score(): number {
    return this.state.answers.filter((answer, i) => QUESTIONS[i].correctChoice === answer.choiceId).length;
  }
  get hintCredits(): number { return this.state.rewardIds.length; }

  submit(choiceId: string): 'correct' | 'wrong' | 'ignored' {
    const q = this.question;
    if (this.blocked || !q || this.answer || !q.choices.some(c => c.id === choiceId)) return 'ignored';
    this.state.answers.push({ questionId: q.id, choiceId });
    return q.correctChoice === choiceId ? 'correct' : 'wrong';
  }
  next(): boolean {
    if (this.blocked || !this.answer || this.finished) return false;
    this.state.index += 1;
    return true;
  }
  togglePause(): void { this.state.paused = !this.state.paused; }
  setHidden(value: boolean): void { this.hidden = value; }
  setAdPending(value: boolean): void { this.adPending = value; }
  grantReward(requestId: string): boolean {
    if (!requestId || this.state.rewardIds.includes(requestId)) return false;
    this.state.rewardIds.push(requestId);
    return true;
  }
  serialize(): string { return JSON.stringify(this.state); }
}

function validateSave(value: unknown): SaveData {
  if (!value || typeof value !== 'object') throw new Error('save-object');
  const s = value as SaveData;
  if (s.schema !== 1 || s.bankRevision !== BANK_REVISION || !Number.isInteger(s.index)
    || s.index < 0 || s.index > QUESTIONS.length || typeof s.paused !== 'boolean'
    || !Array.isArray(s.answers) || !Array.isArray(s.rewardIds)) throw new Error('save-schema');
  if (s.answers.length !== s.index && s.answers.length !== Math.min(s.index + 1, QUESTIONS.length)) {
    throw new Error('save-sequence');
  }
  const answers = s.answers.map((a, i) => {
    const q = QUESTIONS[i];
    if (!q || !a || a.questionId !== q.id || !q.choices.some(c => c.id === a.choiceId)) throw new Error('save-answer');
    return { questionId: a.questionId, choiceId: a.choiceId };
  });
  if (s.rewardIds.length > 10000 || s.rewardIds.some(id => typeof id !== 'string' || !id || id.length > 160)
    || new Set(s.rewardIds).size !== s.rewardIds.length) throw new Error('save-rewards');
  return { schema: 1, bankRevision: BANK_REVISION, index: s.index, answers, paused: s.paused, rewardIds: [...s.rewardIds] };
}
