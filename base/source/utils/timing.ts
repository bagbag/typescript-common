import { firstValueFrom, mapTo, race, timer } from 'rxjs';
import type { ReadonlyCancellationToken } from './cancellation-token';

/**
 * compatibility for consumers with typescript version less than 4.4
 * @deprecated will be removed as it is available in typescripts dom lib
 */
interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): DOMHighResTimeStamp;
}

/** timeout for specified duration */
export async function timeout(milliseconds: number = 0): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/** timeout until specified time */
export async function timeoutUntil(timestamp: number | Date): Promise<void> {
  const left = timestamp.valueOf() - Date.now();
  return timeout(left);
}

/** timeout for specified duration */
export async function cancelableTimeout(milliseconds: number, cancelToken: ReadonlyCancellationToken): Promise<boolean> {
  return firstValueFrom(race([
    timer(milliseconds).pipe(mapTo(false)), // eslint-disable-line @typescript-eslint/no-unsafe-argument
    cancelToken.set$.pipe(mapTo(true)) // eslint-disable-line @typescript-eslint/no-unsafe-argument
  ]));
}

/** timeout until specified time */
export async function cancelableTimeoutUntil(timestamp: number | Date, cancelToken: ReadonlyCancellationToken): Promise<boolean> {
  const left = timestamp.valueOf() - Date.now();
  return cancelableTimeout(left, cancelToken);
}

export async function immediate(): Promise<void> {
  return new Promise<void>(setImmediate as (callback: () => void) => void);
}

export async function nextTick(): Promise<void> {
  return new Promise<void>((resolve) => process.nextTick(resolve));
}

export async function animationFrame(): Promise<number> {
  return new Promise<number>(requestAnimationFrame);
}

export async function idle(timeout?: number): Promise<IdleDeadline> { // eslint-disable-line @typescript-eslint/no-shadow
  return new Promise<IdleDeadline>((resolve) => requestIdleCallback(resolve, { timeout }));
}
