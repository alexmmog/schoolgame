export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface AdRequest { readonly id: string; readonly placement: 'hint'; readonly startedAt: number }
export type AdEvent =
  | { requestId: string; type: 'close'; isEnded?: boolean }
  | { requestId: string; type: 'no-fill' | 'error' };
export interface AdHandle { dispose(): void }
export interface RewardedAdProvider {
  readonly mode: 'simulation' | 'real-unconfigured';
  show(request: AdRequest, emit: (event: AdEvent) => void): AdHandle;
}
