import { AdEvent, AdHandle, AdRequest, RewardedAdProvider } from './contracts';

// TEST ONLY. No SDK calls, network requests, impressions, or revenue tracking.
export class ManualAdSimulator implements RewardedAdProvider {
  readonly mode = 'simulation' as const;
  private callbacks = new Map<string, (event: AdEvent) => void>();
  readonly disposed = new Set<string>();
  show(request: AdRequest, emit: (event: AdEvent) => void): AdHandle {
    this.callbacks.set(request.id, emit);
    return { dispose: () => { this.disposed.add(request.id); } };
  }
  emit(requestId: string, event: AdEvent): void { this.callbacks.get(requestId)?.(event); }
  complete(requestId: string): void { this.emit(requestId, { requestId, type: 'close', isEnded: true }); }
  cancel(requestId: string): void { this.emit(requestId, { requestId, type: 'close', isEnded: false }); }
  noFill(requestId: string): void { this.emit(requestId, { requestId, type: 'no-fill' }); }
  // Retained callbacks let tests deliberately inject duplicate/late SDK-like events.
}

export class UnconfiguredRealAds implements RewardedAdProvider {
  readonly mode = 'real-unconfigured' as const;
  show(): AdHandle { throw new Error('Real AppID, ad unit, account permissions, and SDK validation are required.'); }
}
