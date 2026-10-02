const test = require('node:test');
const assert = require('node:assert/strict');
const { QuizSession } = require('../.test-dist/core/quiz.js');
const { QUESTIONS } = require('../.test-dist/core/questions.js');
const { loadSession, saveSession, SAVE_KEY } = require('../.test-dist/platform/save.js');
const { ManualAdSimulator, UnconfiguredRealAds } = require('../.test-dist/platform/mock-ads.js');
const { RewardCoordinator } = require('../.test-dist/platform/rewarded.js');

function setup(provider = new ManualAdSimulator()) {
  let clock = 1000;
  const rewards = [];
  const statuses = [];
  const coordinator = new RewardCoordinator(provider, n => `test-run:${n}`, id => rewards.push(id),
    status => statuses.push(status), () => clock, 100);
  return { provider, coordinator, rewards, statuses, advance: ms => { clock += ms; } };
}
function memoryStore() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('two/four-option original demo supports correct and wrong submissions', () => {
  assert.deepEqual(QUESTIONS.map(q => q.choices.length), [2, 4, 4]);
  const s = new QuizSession();
  assert.equal(s.submit('60'), 'correct'); s.next();
  assert.equal(s.submit('a'), 'wrong');
  assert.equal(s.score, 1);
});
test('rapid repeated submit and invalid choice cannot change score or answer', () => {
  const s = new QuizSession();
  assert.equal(s.submit('not-a-choice'), 'ignored');
  assert.equal(s.submit('100'), 'wrong');
  for (let i = 0; i < 20; i++) assert.equal(s.submit('60'), 'ignored');
  assert.equal(s.score, 0); assert.equal(s.answer.choiceId, '100');
});
test('next requires an answer; repeated next and submissions after completion are ignored', () => {
  const s = new QuizSession();
  assert.equal(s.next(), false);
  for (const q of QUESTIONS) {
    assert.equal(s.submit(q.correctChoice), 'correct'); assert.equal(s.next(), true);
    assert.equal(s.next(), false);
  }
  assert.equal(s.finished, true); assert.equal(s.score, QUESTIONS.length);
  assert.equal(s.submit('60'), 'ignored');
});
test('pause blocks input and progression, continue restores input', () => {
  const s = new QuizSession(); s.togglePause();
  assert.equal(s.submit('60'), 'ignored'); s.togglePause();
  assert.equal(s.submit('60'), 'correct'); s.togglePause();
  assert.equal(s.next(), false); s.togglePause(); assert.equal(s.next(), true);
});
test('background and active-ad runtime gates block answering without changing durable pause', () => {
  const s = new QuizSession(); s.setHidden(true);
  assert.equal(s.submit('60'), 'ignored'); s.setHidden(false); s.setAdPending(true);
  assert.equal(s.submit('60'), 'ignored');
  const restart = new QuizSession(s.serialize());
  assert.equal(restart.paused, false); assert.equal(restart.blocked, false);
});
test('saved answered question restores with duplicate-submit protection and correct score', () => {
  const s = new QuizSession(); s.submit('60');
  const restored = new QuizSession(s.serialize());
  assert.equal(restored.restoreStatus, 'restored'); assert.equal(restored.score, 1);
  assert.equal(restored.submit('100'), 'ignored'); assert.equal(restored.next(), true);
});
test('completed run restores without opening an extra question', () => {
  const s = new QuizSession();
  for (const q of QUESTIONS) { s.submit(q.correctChoice); s.next(); }
  const restored = new QuizSession(s.serialize());
  assert.equal(restored.finished, true); assert.equal(restored.score, 3); assert.equal(restored.next(), false);
});
test('malformed JSON, schema/revision mismatch, invalid index, and nonsequential answers reset safely', () => {
  const valid = JSON.parse(new QuizSession().serialize());
  const bad = ['broken', JSON.stringify({ ...valid, schema: 2 }), JSON.stringify({ ...valid, bankRevision: 'foreign-bank' }),
    JSON.stringify({ ...valid, index: -1 }), JSON.stringify({ ...valid, index: 2, answers: [] }),
    JSON.stringify({ ...valid, answers: [{ questionId: 'foreign', choiceId: '60' }] }),
    JSON.stringify({ ...valid, rewardIds: ['same', 'same'] })];
  for (const saved of bad) {
    const s = new QuizSession(saved); assert.equal(s.restoreStatus, 'invalid'); assert.equal(s.index, 0);
  }
});
test('local save uses a unique key and leaves other project saves untouched', () => {
  const storage = memoryStore(); storage.values.set('existing-project-save', 'untouched');
  const s = new QuizSession(); s.submit('60');
  assert.equal(saveSession(storage, s), undefined);
  assert.equal(storage.values.get('existing-project-save'), 'untouched');
  assert.equal(loadSession(storage).session.score, 1); assert.ok(storage.values.has(SAVE_KEY));
});
test('storage read/write failures produce explicit warnings and do not crash rules', () => {
  const fail = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  const loaded = loadSession(fail); assert.ok(loaded.warning); assert.equal(loaded.session.score, 0);
  assert.ok(saveSession(fail, loaded.session));
});
test('durable pause and progress restore while ad/background transient gates reset', () => {
  const original = new QuizSession(); original.submit('60'); original.next(); original.togglePause();
  original.setAdPending(true); original.setHidden(true);
  const restored = new QuizSession(original.serialize());
  assert.equal(restored.index, 1); assert.equal(restored.score, 1); assert.equal(restored.paused, true);
  assert.equal(restored.submit('b'), 'ignored'); restored.togglePause();
  assert.equal(restored.blocked, false); assert.equal(restored.submit('b'), 'correct');
});
test('matching explicit completed watch rewards exactly once', () => {
  const x = setup(); const id = x.coordinator.start(); x.provider.complete(id);
  assert.deepEqual(x.rewards, [id]); assert.equal(x.coordinator.status, 'rewarded'); assert.equal(x.coordinator.busy, false);
});
test('cancelled watch, missing completion flag, and nonboolean completion never reward', () => {
  for (const flag of [false, undefined, 'true', 1]) {
    const x = setup(); const id = x.coordinator.start();
    x.provider.emit(id, { requestId: id, type: 'close', isEnded: flag });
    assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.status, 'cancelled');
  }
});
test('no-fill and errors terminate request without rewarding', () => {
  for (const type of ['no-fill', 'error']) {
    const x = setup(); const id = x.coordinator.start(); x.provider.emit(id, { requestId: id, type });
    assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.status, type);
    x.provider.complete(id); assert.deepEqual(x.rewards, []);
  }
});
test('duplicate completion and post-completion cancellation are ignored', () => {
  const x = setup(); const id = x.coordinator.start();
  x.provider.complete(id); x.provider.complete(id); x.provider.cancel(id);
  assert.deepEqual(x.rewards, [id]); assert.equal(x.coordinator.ignoredCallbacks, 2);
});
test('completion after cancellation cannot turn that request into a reward', () => {
  const x = setup(); const id = x.coordinator.start(); x.provider.cancel(id); x.provider.complete(id);
  assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.status, 'cancelled');
});
test('old request callback cannot reward a newer active request', () => {
  const x = setup(); const oldId = x.coordinator.start(); x.provider.cancel(oldId);
  const newId = x.coordinator.start(); x.provider.complete(oldId);
  assert.equal(x.coordinator.requestId, newId); assert.deepEqual(x.rewards, []);
  x.provider.complete(newId); assert.deepEqual(x.rewards, [newId]);
});
test('request ID mismatch cannot reward even through the current provider listener', () => {
  const x = setup(); const id = x.coordinator.start();
  x.provider.emit(id, { requestId: 'different-run:1', type: 'close', isEnded: true });
  assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.requestId, id);
  x.provider.complete(id); assert.deepEqual(x.rewards, [id]);
});
test('second request during an active request is rejected', () => {
  const x = setup(); const first = x.coordinator.start(); assert.equal(x.coordinator.start(), undefined);
  assert.equal(x.coordinator.requestId, first);
});
test('callbacks at or after the deadline cannot reward, including before a timer tick', () => {
  const x = setup(); const id = x.coordinator.start(); x.advance(100); x.provider.complete(id);
  assert.equal(x.coordinator.status, 'timed-out'); assert.deepEqual(x.rewards, []);
  x.provider.complete(id); assert.deepEqual(x.rewards, []);
});
test('background then foreground without completed watch does not reward', () => {
  const x = setup(); x.coordinator.start(); x.coordinator.onHide(); x.coordinator.onShow();
  assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.status, 'showing');
});
test('confirmed completion in background waits for resume and rewards once', () => {
  const x = setup(); const id = x.coordinator.start(); x.coordinator.onHide(); x.provider.complete(id);
  assert.equal(x.coordinator.status, 'completed-pending-resume'); assert.deepEqual(x.rewards, []);
  assert.equal(x.coordinator.start(), undefined); x.provider.complete(id);
  x.advance(1000); x.coordinator.onShow(); x.coordinator.onShow();
  assert.deepEqual(x.rewards, [id]); assert.equal(x.coordinator.busy, false);
});
test('background cancellation or no-fill does not reward on resume', () => {
  for (const type of ['close', 'no-fill']) {
    const x = setup(); const id = x.coordinator.start(); x.coordinator.onHide();
    x.provider.emit(id, { requestId: id, type, isEnded: false }); x.coordinator.onShow();
    assert.deepEqual(x.rewards, []);
  }
});
test('long background interval expires unresolved request on resume', () => {
  const x = setup(); const id = x.coordinator.start(); x.coordinator.onHide(); x.advance(101);
  x.coordinator.onShow(); x.provider.complete(id);
  assert.equal(x.coordinator.status, 'timed-out'); assert.deepEqual(x.rewards, []);
});
test('new requests while backgrounded are rejected', () => {
  const x = setup(); x.coordinator.onHide(); assert.equal(x.coordinator.start(), undefined);
  x.coordinator.onShow(); assert.ok(x.coordinator.start());
});
test('disposing active or pending requests prevents late rewards and new requests', () => {
  for (const pending of [false, true]) {
    const x = setup(); const id = x.coordinator.start();
    if (pending) { x.coordinator.onHide(); x.provider.complete(id); }
    x.coordinator.dispose(); x.provider.complete(id); x.coordinator.onShow();
    assert.deepEqual(x.rewards, []); assert.equal(x.coordinator.start(), undefined);
  }
});
test('synchronous completion during show cleans up the returned handle', () => {
  let disposed = 0;
  const x = setup({ mode: 'simulation', show(request, emit) {
    emit({ requestId: request.id, type: 'close', isEnded: true });
    return { dispose: () => { disposed++; } };
  } });
  const id = x.coordinator.start(); assert.deepEqual(x.rewards, [id]); assert.equal(disposed, 1);
});
test('provider throwing during show fails closed', () => {
  const x = setup({ mode: 'simulation', show() { throw new Error('provider-failure'); } });
  x.coordinator.start(); assert.equal(x.coordinator.status, 'error'); assert.deepEqual(x.rewards, []);
});
test('reentrant callback during disposal cannot grant an extra reward', () => {
  const x = setup({ mode: 'simulation', show(request, emit) {
    return { dispose: () => emit({ requestId: request.id, type: 'close', isEnded: true }) };
  } });
  x.coordinator.start(); x.coordinator.dispose(); assert.deepEqual(x.rewards, []);
});
test('reward ledger persists and refuses duplicate reward IDs after restore', () => {
  const s = new QuizSession(); assert.equal(s.grantReward('confirmed-request:1'), true);
  assert.equal(s.grantReward('confirmed-request:1'), false);
  const restored = new QuizSession(s.serialize());
  assert.equal(restored.grantReward('confirmed-request:1'), false); assert.equal(restored.hintCredits, 1);
});
test('real ads stay unavailable when AppID, placement, and permission have not been provided', () => {
  const x = setup(new UnconfiguredRealAds()); x.coordinator.start();
  assert.equal(x.coordinator.mode, 'real-unconfigured'); assert.equal(x.coordinator.status, 'error');
  assert.deepEqual(x.rewards, []);
});
