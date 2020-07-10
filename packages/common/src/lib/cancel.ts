/**
 * A token that can be used cancel some asynchronous operations.
 */
export interface CancelToken {
  /** A promise that will be rejected if the token is cancelled. */
  promise: Promise<void>;
  /** The reason for cancellation if the token is cancelled */
  reason: Error | undefined;
  /** Throw an error if the token has been cancelled */
  throwIfCancelled(): void;
  /** Cancel the token */
  cancel(reason?: string | Error): void;
  /** Wrap a promise, making it cancellable */
  wrap<T>(promise: PromiseLike<T>): Promise<T>;
}

/**
 * Create a new CancelToken
 */
export function createCancelToken(): CancelToken {
  return new CancelTokenImpl();
}

/**
 * Return true of the given reason represents a cancellation
 */
export function isCancel(reason: Error) {
  return reason && reason.name === 'Cancelled';
}

/**
 * An implementation of CancelToken
 */
class CancelTokenImpl implements CancelToken {
  promise: Promise<void>;
  reason: Error | undefined;

  private _rejectToken!: (reason: Error) => void;

  constructor() {
    this.promise = new Promise<void>((_resolve, reject) => {
      this._rejectToken = reject;
    });

    // Attach a rejection handler to the promise so that cancellations on unused
    // tokens won't cause unhandled rejection errors and crash Node.
    this.promise.catch(() => undefined);
  }

  cancel(reason?: string | Error) {
    if (this.reason) {
      return;
    }

    let cancelReason: Error;

    if (reason instanceof Error) {
      cancelReason = reason;
    } else {
      cancelReason = new Error(reason);
      cancelReason.name = 'Cancelled';
    }

    this.reason = cancelReason;
    this._rejectToken(cancelReason);
  }

  throwIfCancelled() {
    if (this.reason) {
      throw this.reason;
    }
  }

  wrap<T>(promise: PromiseLike<T>) {
    return Promise.race([this.promise, promise]) as Promise<T>;
  }
}
