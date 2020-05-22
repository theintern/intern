import { CancelToken } from '@theintern/common';

export interface Deferred<T> {
  readonly promise: Promise<T>;

  callback<R>(callback: () => R): () => R | undefined;
  callback<T, R>(callback: (arg: T) => R): () => R | undefined;
  callback<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined;

  rejectOnError<R>(callback: () => R): () => R | undefined;
  rejectOnError<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined;

  resolve(value?: T): void;

  reject(error?: Error): void;
}

export default class DeferredImpl<T> implements Deferred<T> {
  private _resolver!: (value?: T) => void;
  private _rejector!: (error?: Error) => void;
  private _remainingCalls: number | undefined;

  readonly promise: Promise<T>;

  constructor(token?: CancelToken, numCallsUntilReslution?: number) {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolver = resolve;
      this._rejector = reject;
    });

    if (token) {
      this.promise = token.wrap(this.promise);
    }

    this._remainingCalls = numCallsUntilReslution;
  }

  /**
   * Wraps any callback to resolve the deferred so long as the callback
   * executes without throwing any Errors.
   */
  callback<R>(callback: () => R): () => R | undefined;
  callback<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined;
  callback<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const dfd = this;
    return this.rejectOnError(function (this: any, ...args: any[]) {
      const returnValue = callback.apply(this, args);
      dfd.resolve();
      return returnValue;
    });
  }

  /**
   * Wraps a callback to reject the deferred if the callback throws an Error.
   */
  rejectOnError<R>(callback: () => R): () => R | undefined;
  rejectOnError<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined;
  rejectOnError<T, R>(
    callback: (...args: T[]) => R
  ): (...args: T[]) => R | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const dfd = this;
    return function (this: any, ...args: T[]) {
      try {
        return callback.apply(this, args);
      } catch (error) {
        dfd.reject(error);
      }
    };
  }

  resolve(value?: T) {
    if (this._remainingCalls != null) {
      --this._remainingCalls;
      if (this._remainingCalls > 0) {
        return;
      }
      if (this._remainingCalls < 0) {
        throw new Error('resolve called too many times');
      }
    }

    this._resolver(value);
  }

  reject(error?: Error) {
    this._rejector(error);
  }
}
