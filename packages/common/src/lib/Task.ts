export interface CancellablePromise<T = any> extends Promise<T> {
  /**
   * Immediately cancels this promise if it has not already resolved. This
   * promise and any descendants are synchronously stopped and any `finally`
   * callbacks added downstream from the canceled promise are invoked.
   */
  cancel(): void;

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A CancellablePromise for the completion of the callback.
   */
  catch<E = never>(
    onrejected?: ((reason: any) => E | PromiseLike<E>) | undefined | null
  ): CancellablePromise<T | E>;

  /**
   * Allows for cleanup actions to be performed after resolution of this
   * promise.
   */
  finally(callback?: (() => void) | undefined | null): CancellablePromise<T>;

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A CancellablePromise for the completion of which ever callback is executed.
   */
  then<V = T, E = never>(
    onfulfilled?: ((value: T) => V | PromiseLike<V>) | undefined | null,
    onrejected?: ((reason: any) => E | PromiseLike<E>) | undefined | null
  ): CancellablePromise<V | E>;
}

/**
 * Task is an implementation of CancellablePromise.
 */
export default class Task<T = any> implements CancellablePromise<T> {
  /** Set for compatibility with Promise */
  readonly [Symbol.toStringTag]: 'Promise';

  /**
   * Return a Task that resolves when one of the passed in objects have
   * resolved
   *
   * @param iterable An iterable of values to resolve. These can be Promises,
   * Tasks, or other objects
   */
  static race<T>(
    iterable: Iterable<T | PromiseLike<T>> | (T | PromiseLike<T>)[]
  ): Task<T> {
    return new this((resolve, reject) => {
      Promise.race<T>(this.unwrapPromises(iterable)).then(resolve, reject);
    });
  }

  /**
   * Return a rejected promise wrapped in a Task
   *
   * @param reason The reason for the rejection
   */
  static reject<T>(reason?: Error): Task<T> {
    return new this((_resolve, reject) => reject(reason));
  }

  /**
   * Return a resolved task.
   */
  public static resolve(): Task<void>;

  /**
   * Return a resolved task.
   *
   * @param value The value to resolve with
   */
  public static resolve<T>(value: T | PromiseLike<T>): Task<T>;

  /**
   * Return a resolved task.
   *
   * @param value The value to resolve with
   */
  public static resolve<T>(value?: any): Task<T> {
    return new this<T>(resolve => resolve(value));
  }

  /**
   * Return a Task that resolves when all of the passed in objects have
   * resolved. When used with a key/value pair, the returned promise's
   * argument is a key/value pair of the original keys with their resolved
   * values.
   *
   * ```ts
   * ExtensiblePromise.all({ one: 1, two: 2 }).then(results => console.log(results));
   * // { one: 1, two: 2 }
   * ```
   *
   * @param iterable An iterable of values to resolve, or a key/value pair of
   * values to resolve. These can be Promises, ExtensiblePromises, or other
   * objects
   */
  static all<T>(iterable: DictionaryOfPromises<T>): Task<{ [key: string]: T }>;

  /**
   * Return a Task that resolves when all of the passed in objects have
   * resolved. When used with a key/value pair, the returned promise's
   * argument is a key/value pair of the original keys with their resolved
   * values.
   *
   * ```ts
   * Task.all({ one: 1, two: 2 }).then(results => console.log(results));
   * // { one: 1, two: 2 }
   * ```
   *
   * @param iterable An iterable of values to resolve, or a key/value pair
   * of values to resolve. These can be Promises, ExtensiblePromises, or
   * other objects
   */
  static all<T>(iterable: (T | PromiseLike<T>)[]): Task<T[]>;

  /**
   * Return a Task that resolves when all of the passed in objects have
   * resolved. When used with a key/value pair, the returned promise's
   * argument is a key/value pair of the original keys with their resolved
   * values.
   *
   * ```ts
   * Task.all({ one: 1, two: 2 }).then(results => console.log(results));
   * // { one: 1, two: 2 }
   * ```
   *
   * @param iterable An iterable of values to resolve, or a key/value pair of
   * values to resolve. These can be Promises, ExtensiblePromises, or other
   * objects
   */
  static all<T>(iterable: T | PromiseLike<T>): Task<T[]>;

  /**
   * Return a Task that resolves when all of the passed in objects have
   * resolved. When used with a key/value pair, the returned promise's
   * argument is a key/value pair of the original keys with their resolved
   * values.
   *
   * ```ts
   * Task.all({ one: 1, two: 2 }).then(results => console.log(results));
   * // { one: 1, two: 2 }
   * ```
   *
   * @param iterable An iterable of values to resolve, or a key/value pair of
   * values to resolve. These can be Promises, ExtensiblePromises, or other
   * objects
   */
  static all<T>(iterable: ListOfPromises<T>): Task<T[]>;

  /**
   * Return a Task that resolves when all of the passed in objects have
   * resolved. When used with a key/value pair, the returned promise's
   * argument is a key/value pair of the original keys with their resolved
   * values.
   *
   * ```ts
   * Task.all({ one: 1, two: 2 }).then(results => console.log(results));
   * // { one: 1, two: 2 }
   * ```
   *
   * @param iterable An iterable of values to resolve, or a key/value pair of
   * values to resolve. These can be Promises, ExtensiblePromises, or other
   * objects
   */
  static all<T>(
    iterable: DictionaryOfPromises<T> | ListOfPromises<T>
  ): Task<any> {
    return new Task(
      (resolve, reject) => {
        let innerTask: Task<{ [key: string]: T } | T[]>;

        if (!isArrayLike(iterable) && !isIterable(iterable)) {
          const promiseKeys = Object.keys(iterable);

          innerTask = new this((innerResolve, innerReject) => {
            Promise.all(promiseKeys.map(key => iterable[key])).then(
              promiseResults => {
                const returnValue: { [key: string]: T } = {};

                promiseResults.forEach((value, index) => {
                  returnValue[promiseKeys[index]] = value;
                });

                innerResolve(returnValue);
              },
              innerReject
            );
          });
        } else {
          innerTask = new this((innerResolve, innerReject) => {
            Promise.all(this.unwrapPromises(<Iterable<T>>iterable)).then(
              innerResolve,
              innerReject
            );
          });
        }

        innerTask.then(resolve, reject);
      },
      () => {
        if (isArrayLike(iterable)) {
          for (let i = 0; i < iterable.length; i++) {
            const promiseLike = iterable[i];

            if (isTask(promiseLike)) {
              promiseLike.cancel();
            }
          }
        } else if (isIterable(iterable)) {
          for (const promiseLike of iterable) {
            if (isTask(promiseLike)) {
              promiseLike.cancel();
            }
          }
        } else {
          Object.keys(iterable).forEach((key: any) => {
            const promiseLike = iterable[key];

            if (isTask(promiseLike)) {
              promiseLike.cancel();
            }
          });
        }
      }
    );
  }

  /**
   * Take a list of values, and if any are Tasks, insert the wrapped Promise in
   * its place, otherwise use the original object. We use this to help use the
   * native Promise methods like `all` and `race`.
   *
   * Returns the list of objects, as an array, with Tasks being replaced by
   * Promises.
   *
   * @param iterable The list of objects to iterate over
   */
  private static unwrapPromises<T>(
    iterable: Iterable<T | PromiseLike<T>> | (T | PromiseLike<T>)[]
  ): (T | PromiseLike<T>)[] {
    const unwrapped: (T | PromiseLike<T>)[] = [];

    if (isArrayLike(iterable)) {
      for (let i = 0; i < iterable.length; i++) {
        const item = iterable[i];
        unwrapped.push(isTask<T>(item) ? item._promise : item);
      }
    } else {
      for (const item of iterable) {
        unwrapped.push(isTask<T>(item) ? item._promise : item);
      }
    }

    return unwrapped;
  }

  /** The wrapped promise */
  private readonly _promise: Promise<T>;

  /**
   * A cancelation handler that will be called if this task is canceled.
   */
  private canceler: () => void;

  /**
   * Children of this Task (i.e., Tasks that were created from this Task with
   * `then` or `catch`).
   */
  private readonly children: Task<any>[];

  /**
   * The finally callback for this Task (if it was created by a call to
   * `finally`).
   */
  private _finally: undefined | (() => void);

  /**
   * The state of the task
   */
  private _state: State;

  /**
   * Create a new task. Executor is run immediately. The canceler will be
   * called when the task is canceled.
   *
   * @param executor Method that initiates some task
   * @param canceler Method to call when the task is canceled
   */
  constructor(
    executor: (
      resolve: (value?: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void,
    canceler?: () => void
  ) {
    // We have to initialize these to avoid a compiler error of using them
    // before they are initialized
    let _resolve!: (value?: T | PromiseLike<T> | undefined) => void;
    let _reject!: (reason?: any) => void;

    this._promise = new Promise<T>((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
    });

    this._state = State.Pending;

    this.children = [];

    this.canceler = () => {
      if (canceler) {
        canceler();
      }
      this._cancel();
    };

    // Don't let the Task resolve if it's been canceled
    try {
      executor(
        value => {
          if (this._state === State.Canceled) {
            return;
          }
          this._state = State.Fulfilled;
          _resolve(value);
        },
        reason => {
          if (this._state === State.Canceled) {
            return;
          }
          this._state = State.Rejected;
          _reject(reason);
        }
      );
    } catch (reason) {
      this._state = State.Rejected;
      _reject(reason);
    }
  }

  /**
   * Propagates cancellation down through a Task tree. The Task's state is
   * immediately set to canceled. If a PromiseLike finally task was passed
   * in, it is resolved before calling this Task's finally callback;
   * otherwise, this Task's finally callback is immediately executed.
   * `_cancel` is called for each child Task, passing in the value returned
   * by this Task's finally callback or a Promise chain that will eventually
   * resolve to that value.
   */
  private _cancel(finallyTask?: void | PromiseLike<any>): void {
    this._state = State.Canceled;

    const runFinally = () => {
      try {
        return this._finally && this._finally();
      } catch (error) {
        // Any errors in a `finally` callback are completely ignored
        // during cancelation
      }
    };

    if (this._finally) {
      if (isPromiseLike(finallyTask)) {
        finallyTask = finallyTask.then(runFinally, runFinally);
      } else {
        finallyTask = runFinally();
      }
    }

    this.children.forEach(child => child._cancel(finallyTask));
  }

  /**
   * Immediately cancels this task if it has not already resolved. This Task
   * and any descendants are synchronously set to the Canceled state and any
   * `finally` added downstream from the canceled Task are invoked.
   */
  cancel(): void {
    if (this._state === State.Pending) {
      this.canceler();
    }
  }

  /**
   * Adds a callback to be invoked when the wrapped Promise is rejected.
   *
   * @param onRejected A function to call to handle the error. The parameter
   * to the function will be the caught error.
   */
  catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined
  ): Task<T | TResult> {
    return this.then(undefined, onRejected);
  }

  /**
   * Allows for cleanup actions to be performed after resolution of a Promise.
   */
  finally(callback?: (() => void) | undefined | null): Task<T> {
    // If this task is already canceled, call the task
    if (this._state === State.Canceled && callback) {
      callback();
      return this;
    }

    const task = this.then<any>(
      value =>
        Task.resolve(callback ? callback() : undefined).then(() => value),
      reason =>
        Task.resolve(callback ? callback() : undefined).then(() => {
          throw reason;
        })
    );

    // Keep a reference to the callback; it will be called if the Task is
    // canceled
    task._finally = callback || undefined;
    return task;
  }

  /**
   * Adds a callback to be invoked when the Task resolves or is rejected.
   *
   * @param onFulfilled A function to call to handle the resolution. The
   * paramter to the function will be the resolved value, if any.
   * @param onRejected A function to call to handle the error. The parameter
   * to the function will be the caught error.
   */
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onRejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2> | undefined)
      | undefined
      | null
  ): Task<TResult1 | TResult2> {
    const task = new (this.constructor as typeof Task)((resolve, reject) => {
      this._promise.then(
        // Don't call the onFulfilled or onRejected handlers if this Task
        // is canceled
        function(value) {
          if (task._state === State.Canceled) {
            resolve();
          } else if (onFulfilled) {
            try {
              resolve(onFulfilled(value));
            } catch (error) {
              reject(error);
            }
          } else {
            resolve(<any>value);
          }
        },
        function(error) {
          if (task._state === State.Canceled) {
            resolve();
          } else if (onRejected) {
            try {
              resolve(onRejected(error));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(error);
          }
        }
      );
    }) as Task<TResult1 | TResult2>;

    task.canceler = () => {
      // If task's parent (this) hasn't been resolved, cancel it;
      // downward propagation will start at the first unresolved parent
      if (this._state === State.Pending) {
        this.cancel();
      } else {
        // If task's parent has been resolved, propagate cancelation to
        // the task's descendants
        task._cancel();
      }
    };

    // Keep track of child Tasks for propogating cancelation back down the
    // chain
    this.children.push(task);

    return task;
  }
}

/**
 * A type guard that determines if `value` is a `Task`
 *
 * @param value The value to guard
 */
export function isTask<T>(value: any): value is Task<T> {
  if (value instanceof Task) {
    return true;
  }

  if (!isPromiseLike(value)) {
    return false;
  }

  const anyVal = <any>value;

  for (const name of ['catch', 'finally', 'cancel']) {
    if (!(name in value) || typeof anyVal[name] !== 'function') {
      return false;
    }
  }

  if (!('children' in anyVal) || !Array.isArray(anyVal.children)) {
    return false;
  }

  return true;
}

/**
 * An object mapping keys to Promises or resolved values
 */
export type DictionaryOfPromises<T = any> = {
  [_: string]: T | PromiseLike<T>;
};

/**
 * A list of Promises or resolved values
 */
export type ListOfPromises<T = any> = Iterable<T | PromiseLike<T>>;

/**
 * Returns true if a given value has a `then` method.
 *
 * @param value The value to check if is PromiseLike
 */
export function isPromiseLike<T>(value: any): value is PromiseLike<T> {
  return (
    value &&
    typeof value === 'object' &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/**
 * The internal state of a task
 */
const enum State {
  Fulfilled = 0,
  Pending = 1,
  Rejected = 2,
  Canceled = 3
}

/**
 * A type guard for checking if something is ArrayLike
 *
 * @param value The value to type guard against
 */
function isArrayLike(value: any): value is ArrayLike<any> {
  return value && typeof value.length === 'number';
}

/**
 * A type guard for checking if something has an Iterable interface
 *
 * @param value The value to type guard against
 */
function isIterable(value: any): value is Iterable<any> {
  return value && typeof value[Symbol.iterator] === 'function';
}
