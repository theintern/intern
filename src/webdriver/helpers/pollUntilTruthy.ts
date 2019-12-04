import pollUntil from './pollUntil';
import { toExecuteString } from '../lib/util';
import { CancellablePromise } from '../../common';

export default function pollUntilTruthy<T>(
  poller: (() => any) | string,
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T>(
  poller: string,
  args?: any[],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T>(
  poller: () => any,
  args?: never[],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U>(
  poller: (u: U) => any,
  args?: [U],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U, V>(
  poller: (u: U, v: V) => any,
  args?: [U, V],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U, V, W>(
  poller: (u: U, v: V, w: W) => any,
  args?: [U, V, W],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U, V, W, X>(
  poller: (u: U, v: V, w: W, x: X) => any,
  args?: [U, V, W, X],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U, V, W, X, Y>(
  poller: (u: U, v: V, w: W, x: X, y: Y) => any,
  args?: [U, V, W, X, Y],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntilTruthy<T, U, V, W, X, Y>(
  poller:
    | (() => any)
    | ((u: U) => any)
    | ((u: U, v: V) => any)
    | ((u: U, v: V, w: W) => any)
    | ((u: U, v: V, w: W, x: X) => any)
    | ((u: U, v: V, w: W, x: X, y: Y) => any)
    | string,
  argsOrTimeout?: any[] | number,
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T> {
  const args: any[] = [];

  if (typeof argsOrTimeout === 'number') {
    pollInterval = timeout;
    timeout = argsOrTimeout;
  } else if (argsOrTimeout) {
    args.push(...argsOrTimeout);
  }

  args.unshift(toExecuteString(poller));

  const _poller = /* istanbul ignore next */ function(poller: string) {
    const args: any[] = Array.prototype.slice.apply(arguments).slice(1);
    const result = new Function(poller).apply(null, args);
    // If result is truthy, return it. Otherwise return `undefined`, which
    // will cause pollUntil to continue polling.
    return result ? result : undefined;
  };

  return pollUntil(toExecuteString(_poller), args, timeout, pollInterval);
}
