import * as util from '../lib/util';
import Command from '../Command';
import { CancellablePromise } from '../../common';

/**
 * A [[Command]] helper that polls for a value within the client environment
 * until the value exists or a timeout is reached.
 *
 * ```js
 * import Command from 'leadfoot/Command';
 * import pollUntil from 'leadfoot/helpers/pollUntil';
 *
 * new Command(session)
 *     .get('http://example.com')
 *     .then(pollUntil('return document.getElementById("a");', 1000))
 *     .then(
 *         elementA => {
 *             // element was found
 *         },
 *         error => {
 *             // element was not found
 *         }
 *     );
 * ```
 *
 * ```js
 * import Command from 'leadfoot/Command';
 * import pollUntil from 'leadfoot/helpers/pollUntil';
 *
 * new Command(session)
 *     .get('http://example.com')
 *     .then(pollUntil(value => {
 *         const element = document.getElementById('a');
 *         return element && element.value === value ? true : null;
 *     }, [ 'foo' ], 1000))
 *     .then(
 *         () => {
 *             // value was set to 'foo'
 *         },
 *         error => {
 *             // value was never set
 *         }
 *     );
 * ```
 *
 * @param poller The poller function to execute on an interval. The function
 * should return `null` or `undefined` if there is not a result. If the poller
 * function throws, polling will halt.
 *
 * @param args An array of arguments to pass to the poller function when it is
 * invoked. Only values that can be serialised to JSON, plus [[Element]]
 * objects, can be specified as arguments.
 *
 * @param timeout The maximum amount of time to wait for a successful result,
 * in milliseconds. If not specified, the current `executeAsync` maximum
 * timeout for the session will be used.
 *
 * @param pollInterval The amount of time to wait between calls to the poller
 * function, in milliseconds. If not specified, defaults to 67ms.
 *
 * @returns A [[Command]] callback function that, when called, returns a
 * promise that resolves to the value returned by the poller function on
 * success and rejects on failure.
 */
export default function pollUntil<T>(
  poller: (() => any) | string,
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T>(
  poller: string,
  args?: any[],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T>(
  poller: () => any,
  args?: never[],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U>(
  poller: (u: U) => any,
  args?: [U],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U, V>(
  poller: (u: U, v: V) => any,
  args?: [U, V],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U, V, W>(
  poller: (u: U, v: V, w: W) => any,
  args?: [U, V, W],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U, V, W, X>(
  poller: (u: U, v: V, w: W, x: X) => any,
  args?: [U, V, W, X],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U, V, W, X, Y>(
  poller: (u: U, v: V, w: W, x: X, y: Y) => any,
  args?: [U, V, W, X, Y],
  timeout?: number,
  pollInterval?: number
): () => CancellablePromise<T>;

export default function pollUntil<T, U, V, W, X, Y>(
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
  let args: any[] | undefined;

  if (typeof argsOrTimeout === 'number') {
    pollInterval = timeout;
    timeout = argsOrTimeout;
  } else {
    args = argsOrTimeout;
  }

  args = args || [];
  pollInterval = pollInterval || 67;

  return function(this: Command<any>) {
    const session = this.session;
    let originalTimeout: number;

    return session.getExecuteAsyncTimeout().then(function(currentTimeout) {
      let resultOrError: T | Error;

      function storeResult(result: any) {
        resultOrError = result;
      }

      function finish() {
        if (resultOrError instanceof Error) {
          throw resultOrError;
        }
        if (resultOrError == null) {
          const error = new Error('Polling timed out with no result');
          error.name = 'ScriptTimeout';
          throw error;
        }
        return resultOrError;
      }

      function cleanup() {
        if (!isNaN(originalTimeout)) {
          return session.setExecuteAsyncTimeout(originalTimeout).then(finish);
        }
        return finish();
      }

      if (!isNaN(<number>timeout)) {
        originalTimeout = currentTimeout;
      } else {
        timeout = currentTimeout;
      }

      return session
        .setExecuteAsyncTimeout(timeout!)
        .then(function() {
          /* jshint maxlen:140 */
          return session.executeAsync(
            /* istanbul ignore next */ function(
              poller: string | Function,
              args: any[],
              timeout: number,
              pollInterval: number,
              done: Function
            ): void {
              /* jshint evil:true */
              poller = <Function>new Function(<string>poller);

              const endTime = Number(new Date()) + timeout;

              (function poll(this: any) {
                const result = poller.apply(this, args);

                /*jshint evil:true */
                if (result != null) {
                  done(result);
                } else if (Number(new Date()) < endTime) {
                  setTimeout(poll, pollInterval);
                } else {
                  done(null);
                }
              })();
            },
            [util.toExecuteString(poller), args, timeout, pollInterval]
          );
        })
        .then(storeResult, storeResult)
        .then(cleanup, cleanup);
    });
  };
}
