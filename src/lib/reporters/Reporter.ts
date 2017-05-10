import Formatter from '../common/Formatter';
import { mixin } from '@dojo/core/lang';
import Executor, { Events, Handle } from '../executors/Executor';

export default class Reporter<
	E extends Executor = Executor,
	C extends ReporterOptions = ReporterOptions,
	V extends Events = Events
> implements ReporterProperties {
	readonly executor: E;

	protected _console: Console;

	protected _executor: Executor;

	/**
	 * A mapping from event names to the names of methods on this object. This property should be defined on the class
	 * prototype. It is automatically created by the @eventHandler decorator.
	 */
	protected _eventHandlers: { [eventName in keyof V]: string };

	protected _handles: Handle[];

	protected _output: ReporterOutput;

	constructor(executor: E, config: C = <C>{}) {
		mixin(this, config);
		this.executor = executor;
		this._registerEventHandlers();
	}

	get console() {
		if (!this._console) {
			this._console = getConsole();
		}
		return this._console;
	}

	set console(value: Console) {
		this._console = value;
	}

	get formatter(): Formatter {
		return this.executor.formatter;
	}

	get output() {
		if (!this._output) {
			// Use process.stdout in a Node.js environment, otherwise construct a writable-like object that outputs to
			// the console.
			if (typeof process !== 'undefined') {
				return process.stdout;
			}
			else {
				const _console = this.console;
				this._output = {
					write(chunk: string, _encoding: string, callback: Function) {
						_console.log(chunk);
						callback();
					},
					end(chunk: string, _encoding: string, callback: Function) {
						_console.log(chunk);
						callback();
					}
				};
			}
		}
		return this._output;
	}

	set output(value: ReporterOutput) {
		this._output = value;
	}

	/**
	 * Register any handlers added to the class event handlers map
	 */
	protected _registerEventHandlers() {
		if (!this._eventHandlers) {
			return;
		}

		// Use a for..in loop because _eventHandlers may inherit from a parent
		for (let name in this._eventHandlers) {
			this.executor.on(<keyof Events>name, (...args: any[]) => {
				const handler = this._eventHandlers[name];
				return (<any>this)[handler](...args);
			});
		}
	}
}

/**
 * Create a decorator that will add a decorated method to a class's list of event handlers.
 */
export function createEventHandler<E extends Events>() {
	return function (name?: keyof E) {
		return function<T extends keyof E> (
			target: any,
			propertyKey: T,
			_descriptor: TypedPropertyDescriptor<(data: E[T]) => void>
		) {
			if (!target.hasOwnProperty('_eventHandlers')) {
				if (target._eventHandlers != null) {
					// If there's an _eventHandlers property on a parent, inherit from it
					target._eventHandlers = Object.create(target._eventHandlers);
				}
				else {
					target._eventHandlers = {};
				}
			}
			target._eventHandlers[name || propertyKey] = propertyKey;
		};
	};
}

/**
 * The default event handler decorator.
 */
export const eventHandler = createEventHandler<Events>();

export interface ReporterProperties {
	output: ReporterOutput;
}

export type ReporterOptions = Partial<ReporterProperties>;

/**
 * A stream that reporters can write to
 */
export interface ReporterOutput {
	write(chunk: string | Buffer, encoding?: string, callback?: Function): void;
	end(chunk: string | Buffer, encoding?: string, callback?: Function): void;
}

function getConsole() {
	if (typeof console !== 'undefined') {
		return console;
	}

	return <Console> {
		assert: noop,
		count: noop,
		dir: noop,
		error: noop,
		exception: noop,
		info: noop,
		log: noop,
		table: noop,
		time: noop,
		timeEnd: noop,
		trace: noop,
		warn: noop
	};
}

function noop() {
	// do nothing
}
