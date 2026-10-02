import { AdEvent, AdHandle, AdRequest, RewardedAdProvider } from './contracts';

export type AdStatus = 'idle' | 'showing' | 'completed-pending-resume' | 'rewarded'
  | 'cancelled' | 'no-fill' | 'error' | 'timed-out' | 'disposed';
interface Active { request: AdRequest; handle?: AdHandle }

export class RewardCoordinator {
  private active?: Active;
  private pending?: string;
  private hidden = false;
  private closed = false;
  private sequence = 0;
  private seenIds = new Set<string>();
  status: AdStatus = 'idle';
  ignoredCallbacks = 0;
  readonly mode: RewardedAdProvider['mode'];

  constructor(
    private readonly provider: RewardedAdProvider,
    private readonly nextId: (sequence: number) => string,
    private readonly reward: (requestId: string) => void,
    private readonly changed: (status: AdStatus) => void = () => {},
    private readonly now: () => number = Date.now,
    private readonly timeoutMs = 120000,
  ) { this.mode = provider.mode; }

  get busy(): boolean { return !!this.active || !!this.pending; }
  get requestId(): string | undefined { return this.active?.request.id; }

  start(): string | undefined {
    if (this.closed || this.hidden || this.busy) return undefined;
    const id = this.nextId(++this.sequence);
    if (!id || this.seenIds.has(id)) throw new Error('Request IDs must be unique for this run');
    this.seenIds.add(id);
    const request: AdRequest = { id, placement: 'hint', startedAt: this.now() };
    this.active = { request };
    this.setStatus('showing');
    try {
      const handle = this.provider.show(request, event => this.accept(event));
      if (this.active?.request.id === id) this.active.handle = handle;
      else this.disposeHandle(handle); // Handles a synchronous terminal callback.
    } catch { this.accept({ requestId: id, type: 'error' }); }
    return id;
  }

  private accept(event: AdEvent): void {
    const active = this.active;
    if (this.closed || !active || event.requestId !== active.request.id) { this.ignoredCallbacks++; return; }
    if (this.now() - active.request.startedAt >= this.timeoutMs) { this.finish('timed-out'); return; }
    if (event.type === 'close') {
      if (event.isEnded !== true) { this.finish('cancelled'); return; }
      // Only a matching, live request with an explicit completed-watch signal gets here.
      const id = active.request.id;
      if (this.hidden) {
        this.pending = id;
        this.finish('completed-pending-resume');
      } else {
        this.finish('rewarded', () => this.reward(id));
      }
    } else this.finish(event.type);
  }

  onHide(): void { this.hidden = true; }
  onShow(): void {
    this.hidden = false;
    if (this.closed) return;
    if (this.pending) {
      const id = this.pending;
      this.pending = undefined;
      this.reward(id);
      this.setStatus('rewarded');
    } else this.tick(); // A lifecycle event alone never grants a reward.
  }
  tick(): void {
    if (this.active && this.now() - this.active.request.startedAt >= this.timeoutMs) this.finish('timed-out');
  }
  dispose(): void {
    this.closed = true;
    this.pending = undefined;
    this.finish('disposed');
  }
  private finish(status: AdStatus, beforeNotify?: () => void): void {
    const handle = this.active?.handle;
    this.active = undefined; // Clear ownership before detaching, including reentrant callbacks.
    this.disposeHandle(handle);
    beforeNotify?.();
    this.setStatus(status);
  }
  private disposeHandle(handle?: AdHandle): void {
    try { handle?.dispose(); } catch { /* A teardown error cannot resurrect an ad request. */ }
  }
  private setStatus(status: AdStatus): void { this.status = status; this.changed(status); }
}
