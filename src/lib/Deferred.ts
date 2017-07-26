export default class Deferred<T> {
	private _resolver: (value?: T) => void;
	private _rejector: (error?: Error) => void;
	readonly promise: Promise<T>;

	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this._resolver = resolve;
			this._rejector = reject;
		});
		this.promise.then(() => this._finalize, () => this._finalize);
	}

	/**
	 * Wraps any callback to resolve the deferred so long as the callback
	 * executes without throwing any Errors.
	 */
	callback(callback: Function): any {
		return this.rejectOnError((...args: any[]) => {
			const returnValue = callback.apply(this, args);
			this.resolve();
			return returnValue;
		});
	}

	/**
	 * Wraps a callback to reject the deferred if the callback throws an Error.
	 */
	rejectOnError(callback: Function): any {
		return (...args: any[]) => {
			try {
				return callback.apply(this, args);
			}
			catch (error) {
				this.reject(error);
			}
		};
	}

	resolve(value?: T) {
		this._resolver(value);
	}

	reject(error?: Error) {
		this._rejector(error);
	}

	protected _finalize() {
		this._resolver = () => { };
		this._rejector = () => { };
	}
}
