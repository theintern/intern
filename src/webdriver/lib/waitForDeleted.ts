import { Task, CancellablePromise } from '../../common';
import statusCodes from './statusCodes';
import Session from '../Session';
import Element from '../Element';

import { Strategy } from './Locator';

/**
 * Waits for all elements findable in the currently active window/frame
 * using the given strategy and value to be destroyed.
 *
 * @param session The session to consider.
 *
 * @param locator The particular instance that will perform the locating.
 *
 * @param using The element retrieval strategy to use. See
 * [[Command.Command.find]] for options.
 *
 * @param value The strategy-specific value to search for. See
 * [[Command.Command.find]] for details.
 *
 * @returns a Task that resolves when no matching elements can be found, or
 * rejects if matching elements still exist after the find timeout.
 */
export default function waitForDeleted(
  session: Session,
  locator: Session | Element,
  using: Strategy,
  value: string
): CancellablePromise<void> {
  let originalTimeout: number;

  return session
    .getTimeout('implicit')
    .then(value => {
      originalTimeout = value;
      session.setTimeout('implicit', 0);
    })
    .then(function() {
      return new Task((resolve, reject) => {
        const startTime = Date.now();

        (function poll() {
          if (Date.now() - startTime > originalTimeout) {
            const always = function() {
              const error: any = new Error();
              error.status = 21;
              const [name, message] = (<any>statusCodes)[error.status];
              error.name = name;
              error.message = message;
              reject(error);
            };
            session
              .setTimeout('implicit', originalTimeout)
              .then(always, always);
            return;
          }

          locator.find(using, value).then(poll, function(error) {
            const always = function() {
              /* istanbul ignore else: other errors should never occur during normal operation */
              if (error.name === 'NoSuchElement') {
                resolve();
              } else {
                reject(error);
              }
            };
            session
              .setTimeout('implicit', originalTimeout)
              .then(always, always);
          });
        })();
      });
    })
    .then(() => {});
}
