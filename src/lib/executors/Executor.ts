import Suite from '../Suite';
import Test from '../Test';
import { deepMixin } from '@dojo/core/lang';
import { Handle } from '@dojo/interfaces/core';
import Task from '@dojo/core/async/Task';
import ErrorFormatter, { ErrorFormatOptions } from '../common/ErrorFormatter';
import { normalizePathEnding, parseValue, pullFromArray } from '../common/util';
import Reporter, { ReporterOptions } from '../reporters/Reporter';
import getObjectInterface, { ObjectInterface } from '../interfaces/object';
import getTddInterface, { TddInterface } from '../interfaces/tdd';
import getBddInterface, { BddInterface } from '../interfaces/bdd';
import getBenchmarkInterface, { BenchmarkInterface } from '../interfaces/benchmark';
import Promise from '@dojo/shim/Promise';
import * as chai from 'chai';
import global from '@dojo/core/global';
import Deferred from '../Deferred';

/**
 * This is the default executor class.
 */
export default abstract class Executor<E extends Events = Events, C extends Config = Config> {
	protected _assertions: { [name: string]: any };

	protected _availableReporters: { [name: string]: typeof Reporter };

	/** The resolved configuration for this executor. */
	protected _config: C;

	/**
	 * The root suites managed by this executor.
	 */
	protected _rootSuite: Suite;

	protected _errorFormatter: ErrorFormatter;

	protected _hasSuiteErrors = false;

	protected _interfaces: { [name: string]: any };

	protected _loader: Loader;

	protected _loadingPlugin: Task<void> | undefined;

	protected _loadingPluginOptions: any | undefined;

	protected _listeners: { [event: string]: Listener<any>[] };

	protected _pluginExports: { [name: string]: { [name: string]: any } };

	protected _reporters: Reporter[];

	protected _runTask: Task<void>;

	constructor(config?: Partial<C>) {
		this._config = <C>{
			bail: false,
			baseline: false,
			benchmark: false,
			debug: false,
			defaultTimeout: 30000,
			excludeInstrumentation: /(?:node_modules|browser|tests)\//,
			filterErrorStack: false,
			grep: new RegExp(''),
			instrumenterOptions: {
				coverageVariable: '__coverage__'
			},
			loader: { script: 'default' },
			name: 'intern',
			plugins: <PluginDescriptor[]>[],
			reporters: <ReporterDescriptor[]>[],
			suites: <string[]>[]
		};

		if (config) {
			this.configure(config);
		}

		this._availableReporters = {};
		this._listeners = {};
		this._reporters = [];
		this._assertions = {};
		this._interfaces = {};
		this._pluginExports = {};

		this.registerInterface('object', getObjectInterface(this));
		this.registerInterface('tdd', getTddInterface(this));
		this.registerInterface('bdd', getBddInterface(this));
		this.registerInterface('benchmark', getBenchmarkInterface(this));

		this.registerAssertions('assert', chai.assert);
		this.registerAssertions('expect', chai.expect);
		this.registerAssertions('should', chai.should);

		this._rootSuite = new Suite({ executor: this });

		// This is the first suiteEnd listener. When the root unit test suite ends, it will emit a coverage message
		// before any other suiteEnd listeners are called.
		this.on('suiteEnd', suite => {
			if (!suite.hasParent && !suite.sessionId) {
				return this._emitCoverage('unit tests');
			}
		});
	}

	abstract get environment(): string;

	get config() {
		return this._config;
	}

	/**
	 * Format an error, normalizing the stack trace and resolving source map references
	 */
	formatError(error: Error, options?: ErrorFormatOptions) {
		return this._errorFormatter.format(error, options);
	}

	/**
	 * Load a script or scripts. This is a convenience method for loading and evaluating simple scripts, not modules. If
	 * multiple script paths are provided, scripts will be loaded sequentially in the order given.
	 *
	 * @param script a path to a script
	 */
	abstract loadScript(script: string | string[]): Task<void>;

	/**
	 * Add a suite to the set of suites that will be run when `run` is called. The suited is added by calling a factory
	 * function. The use of a factory allows for distinct instances of a given suite to be create when an executor has
	 * multiple root suites.
	 * parent suites.
	 *
	 * @param factory A function that will create a Suite object and add it to a given parent suite
	 */
	addSuite(factory: (parentSuite: Suite) => void) {
		factory(this._rootSuite);
	}

	/**
	 * Update this executor's configuration with a Config object.
	 *
	 * Note that non-object properties will replace existing properties. Object propery values will be deeply mixed into
	 * any existing value.
	 */
	configure(config: Partial<C>) {
		Object.keys(config).forEach((key: keyof Config) => {
			const value = config[key];
			const addToExisting = key[key.length - 1] === '+';
			if (addToExisting) {
				key = <keyof Config>key.slice(0, key.length - 1);
			}
			this._processOption(key, value, addToExisting);
		});
	}

	/**
	 * Create a Deferred object that can be used in enviroments without native Promises
	 */
	createDeferred<T>() {
		return new Deferred<T>();
	}

	/**
	 * Emit an event to all registered listeners.
	 *
	 * Event listeners may execute async code, and a failing handler (one that rejects or throws an error) will cause the
	 * emit to fail.
	 */
	emit(eventName: 'afterRun'): Task<any>;
	emit(eventName: 'beforeRun'): Task<any>;
	emit(eventName: 'runStart'): Task<any>;
	emit(eventName: 'runEnd'): Task<any>;
	emit<T extends keyof E>(eventName: T, data: E[T]): Task<any>;
	emit<T extends keyof E>(eventName: T, data?: E[T]): Task<any> {
		if (eventName === 'suiteEnd' && (<any>data).error) {
			this._hasSuiteErrors = true;
		}

		const notifications: Promise<any>[] = [];

		(this._listeners[eventName] || []).forEach(listener => {
			notifications.push(Promise.resolve(listener(data)));
		});

		const starListeners = this._listeners['*'] || [];
		if (starListeners.length > 0) {
			const starEvent = { name: eventName, data };
			starListeners.forEach(listener => {
				notifications.push(Promise.resolve(listener(starEvent)));
			});
		}

		if (notifications.length === 0) {
			// Report an error when no error listeners are registered
			if (eventName === 'error') {
				console.error('ERROR:', this.formatError(<any>data));
			}

			return resolvedTask;
		}

		return Task.all(notifications).catch(error => {
			console.error(`Error emitting ${eventName}: ${this.formatError(error)}`);
		});
	}

	getAssertions(name: 'assert'): Chai.AssertStatic;
	getAssertions(name: 'expect'): Chai.ExpectStatic;
	getAssertions(name: 'should'): Chai.Should;
	getAssertions(name: string): any;
	getAssertions(name: string): any {
		const assertions = this._assertions[name];

		// `should` is a weird case because it extends Object
		if (name === 'should') {
			return assertions();
		}

		return assertions;
	}

	/**
	 * Return a testing interface
	 */
	getInterface(name: 'object'): ObjectInterface;
	getInterface(name: 'tdd'): TddInterface;
	getInterface(name: 'bdd'): BddInterface;
	getInterface(name: 'benchmark'): BenchmarkInterface;
	getInterface(name: string): any;
	getInterface(name: string): any {
		return this._interfaces[name];
	}

	/**
	 * Return any resources registered by a plugin
	 */
	getPlugin(name: string): { [name: string]: any } | undefined {
		return this._pluginExports[name];
	}

	/**
	 * Convenience method for emitting log events
	 */
	log(...args: any[]) {
		if (this.config.debug) {
			const message = args.map(arg => {
				const type = typeof arg;
				if (type === 'string') {
					return arg;
				}
				if (type === 'function' || arg instanceof RegExp) {
					return arg.toString();
				}
				if (arg instanceof Error) {
					arg = { name: arg.name, message: arg.message, stack: arg.stack };
				}
				try {
					return JSON.stringify(arg);
				}
				catch (error) {
					return arg.toString();
				}
			}).join(' ');
			return this.emit('log', message);
		}
		else {
			return resolvedTask;
		}
	}

	/**
	 * Add a listener for a test event. When an event is emitted, the executor will wait for all Promises returned by
	 * listener callbacks to resolve before continuing.
	 */
	on<T extends keyof E>(eventName: T, listener: Listener<E[T]>): Handle {
		let listeners = this._listeners[eventName];
		if (!listeners) {
			listeners = this._listeners[eventName] = [];
		}

		if (listeners.indexOf(listener) === -1) {
			listeners.push(listener);
		}

		const handle: Handle = {
			destroy(this: any) {
				this.destroy = function () { };
				pullFromArray(listeners, listener);
			}
		};
		return handle;
	}

	/**
	 * Register an assertion library.
	 */
	registerAssertions(name: string, assertions: any) {
		this._assertions[name] = assertions;
	}

	/**
	 * Register an interface.
	 */
	registerInterface(name: string, iface: any) {
		this._interfaces[name] = iface;
	}

	/**
	 * Register a loader script that will be loaded at the beginning of the testing process. Intern assumes this script
	 * will handle the loading of test suites.
	 */
	registerLoader(loader: Loader) {
		this._loader = loader;
	}

	/**
	 * Register a plugin that will be loaded at the beginning of the testing process (before any external loader is
	 * initialized). This method should only be called from a plugin being loaded via the config.plugins option.
	 */
	registerPlugin(name: string, init: PluginInitializer) {
		this._loadingPlugin = Task.resolve(init(this._loadingPluginOptions)).then(exports => {
			if (exports) {
				this._pluginExports[name] = exports;
			}
		});
	}

	/**
	 * Install a reporter constructor
	 */
	registerReporter(name: string, Class: typeof Reporter) {
		this._availableReporters[name] = Class;
	}

	/**
	 * Run tests. This method sets up the environment for test execution, runs the tests, and runs any finalization code
	 * afterwards. Subclasses should override `_beforeRun`, `_runTests`, and `_afterRun` to alter how tests are run.
	 */
	run() {
		// Only allow the executor to be started once
		if (!this._runTask) {
			let runError: Error;

			try {
				this._runTask = this._resolveConfig();

				if (this.config.resolveConfig) {
					this._runTask = this._runTask.then(() => {
						console.log(JSON.stringify(this.config, null, '    '));
					});
				}
				else {
					this._runTask = this._runTask
						.then(() => this._loadPlugins())
						.then(() => this.emit('beforeRun'))
						.then(() => this._beforeRun())
						.then(() => this._loadSuites())
						.then(() => {
							return this.emit('runStart')
								.then(() => this._runTests())
								.finally(() => {
									if (this._hasSuiteErrors) {
										throw new Error('One or more suite errors occurred during testing');
									}
								})
								.catch(error => {
									this.emit('error', error);
									runError = error;
								})
								.finally(() => this.emit('runEnd'));
						})
						.finally(() => this._afterRun())
						.finally(() => this.emit('afterRun'))
						.catch(error => {
							return this.emit('error', error).finally(() => {
								// a runError has priority
								throw runError || error;
							});
						})
						.then(() => {
							// If we didn't have any other errors, but a runError was caught, throw it to reject the run
							// task
							if (runError) {
								throw runError;
							}
						});
				}
			}
			catch (error) {
				this._runTask = this.emit('error', error).then(() => {
					return Task.reject<void>(error);
				});
			}
		}

		return this._runTask;
	}

	/**
	 * Register a testing interface on this executor. A testing interface can be anything that will allow a test to
	 * register tests on the executor. For example, the 'object' interface is a single method, `registerSuite`, that a
	 * test can call to register a suite.
	 */
	setInterface(name: string, iface: any) {
		this._interfaces[name] = iface;
	}

	/**
	 * Code to execute after the main test run has finished to shut down the test system.
	 */
	protected _afterRun() {
		return resolvedTask;
	}

	/**
	 * Code to execute before the main test run has started to set up the test system. This is where Executors can do
	 * any last-minute configuration before the testing process begins.
	 */
	protected _beforeRun(): Task<any> {
		const config = this.config;

		config.reporters.forEach(reporter => {
			if (typeof reporter === 'string') {
				const ReporterClass = this._getReporter(reporter);
				this._reporters.push(new ReporterClass(this));
			}
			else {
				const ReporterClass = this._getReporter(reporter.name);
				this._reporters.push(new ReporterClass(this, reporter.options));
			}
		});

		this._rootSuite.bail = config.bail;
		this._rootSuite.grep = config.grep;
		this._rootSuite.name = config.name;
		this._rootSuite.timeout = config.defaultTimeout;

		return resolvedTask;
	}

	protected _emitCoverage(source?: string) {
		const coverage = global[this.config.instrumenterOptions.coverageVariable];
		if (coverage) {
			return this.emit('coverage', { coverage, source, sessionId: (<any>this.config).sessionId });
		}
	}

	/**
	 * Return a reporter constructor corresponding to the given name
	 */
	protected _getReporter(name: string): typeof Reporter {
		if (!this._availableReporters[name]) {
			throw new Error(`A reporter named "${name}" has not been registered`);
		}
		return this._availableReporters[name];
	}

	/**
	 * Load suites
	 */
	protected _loadSuites(config?: Config) {
		config = config || this.config;

		let script = config.loader.script;
		switch (script) {
			case 'default':
			case 'dojo':
			case 'dojo2':
			case 'systemjs':
				script = `${config.internPath}loaders/${script}.js`;
		}

		return this.loadScript(script).then(() => {
			if (!this._loader) {
				throw new Error(`Loader script ${script} did not register a loader callback`);
			}
			return Task.resolve(this._loader(config || this.config));
		});
	}

	/**
	 * Load plugins
	 */
	protected _loadPlugins(config?: Config) {
		config = config || this.config;
		if (config.plugins) {
			return config.plugins.reduce((previous, plugin) => {
				return previous.then(() => {
					this._loadingPluginOptions = plugin.options;
					return this.loadScript(plugin.script).then(() => {
						return Task.resolve(this._loadingPlugin);
					}).finally(() => {
						this._loadingPlugin = undefined;
						this._loadingPluginOptions = undefined;
					});
				});
			}, Task.resolve());
		}
		return resolvedTask;
	}

	/**
	 * Process an arbitrary config value. Subclasses can override this method to pre-process arguments or handle them
	 * instead of allowing Executor to.
	 */
	protected _processOption(name: keyof Config, value: any, addToExisting: boolean) {
		switch (name) {
			case 'loader':
				if (typeof value === 'string') {
					try {
						value = parseValue(name, value, 'object');
					}
					catch (error) {
						value = { script: value };
					}
				}

				if (!value.script) {
					throw new Error(`Invalid value "${value}" for ${name}`);
				}

				this._setOption(name, value);
				break;

			case 'bail':
			case 'baseline':
			case 'benchmark':
			case 'debug':
				this._setOption(name, parseValue(name, value, 'boolean'));
				break;

			case 'filterErrorStack':
				value = parseValue(name, value, 'boolean');
				this._setOption(name, value);
				this._errorFormatter.filterErrorStack = value;
				break;

			case 'internPath':
				this._setOption(name, parseValue(name, value, 'string'));
				break;

			case 'defaultTimeout':
				this._setOption(name, parseValue(name, value, 'number'));
				break;

			case 'excludeInstrumentation':
				if (value === true) {
					this._setOption(name, value);
				}
				else if (typeof value === 'string' || value instanceof RegExp) {
					this._setOption(name, parseValue(name, value, 'regexp'));
				}
				else {
					throw new Error(`Invalid value "${value}" for ${name}; must be (string | RegExp | true)`);
				}
				break;

			case 'grep':
				this._setOption(name, parseValue(name, value, 'regexp'));
				break;

			case 'instrumenterOptions':
				this._setOption(name, deepMixin({}, this.config[name], parseValue(name, value, 'object')));
				break;

			case 'reporters':
				this._setOption(name, parseValue(name, value, 'object[]', 'name'), addToExisting);
				break;

			case 'plugins':
				this._setOption(name, parseValue(name, value, 'object[]', 'script'), addToExisting);
				break;

			case 'name':
				value = parseValue(name, value, 'string');
				this._setOption(name, value);
				break;

			case 'suites':
				this._setOption(name, parseValue(name, value, 'string[]'), addToExisting);
				break;

			default:
				this._setOption(name, value);
		}
	}

	protected _setOption(name: keyof C, value: any, addToExisting = false) {
		// addToExisting
		if (addToExisting) {
			if (!Array.isArray(this.config[name])) {
				throw new Error('Only array values may currently be added to');
			}

			const currentValue: any[] = this.config[name];
			if (Array.isArray(value)) {
				currentValue.push(...value);
			}
			else {
				currentValue.push(value);
			}
		}
		else {
			this.config[name] = value;
		}
	}

	/**
	 * Resolve the config object.
	 */
	protected _resolveConfig() {
		const config = this.config;

		if (config.internPath != null) {
			config.internPath = normalizePathEnding(config.internPath);
		}

		if (config.benchmark) {
			config.benchmarkConfig = deepMixin({
				id: 'Benchmark',
				filename: 'baseline.json',
				mode: 'test' as 'test',
				thresholds: {
					warn: { rme: 3, mean: 5 },
					fail: { rme: 6, mean: 10 }
				},
				verbosity: 0
			}, config.benchmarkConfig || {});
		}

		return resolvedTask;
	}

	/**
	 * Runs each of the root suites, limited to a certain number of suites at the same time by `maxConcurrency`.
	 */
	protected _runTests() {
		return this._rootSuite.run();
	}
}

export function initialize<E extends Events, C extends Config, T extends Executor<E, C>>(
	ExecutorClass: ExecutorConstructor<E, C, T>,
	config?: Partial<C>
): T {
	if (global['intern']) {
		throw new Error('Intern has already been initialized in this environment');
	}
	const executor = new ExecutorClass(config);
	global.intern = executor;
	return executor;
}

export interface ExecutorConstructor<E extends Events, C extends Config, T extends Executor<E, C>> {
	new (config?: Partial<C>): T;
}

export { Handle };

export interface Config {
	/** If true, Intern will exit as soon as any test fails. */
	bail: boolean;

	baseline: boolean;

	/** The path to the project base */
	basePath: string;

	benchmark: boolean;
	benchmarkConfig?: {
		id: string;
		filename: string;
		mode: 'test' | 'baseline',
		thresholds: {
			warn: { rme: number, mean: number },
			fail: { rme: number, mean: number }
		};
		verbosity: number;
	};

	/** If true, emit and display debug messages. */
	debug: boolean;

	/** The default timeout for async tests, in ms. */
	defaultTimeout: number;

	/** A regexp matching file names that shouldn't be instrumented, or `true` to disable instrumentation. */
	excludeInstrumentation: true | RegExp;

	/** If true, filter external library calls and runtime calls out of error stacks. */
	filterErrorStack: boolean;

	/** A regexp matching tests that should be run. It defaults to `/./` (which matches everything). */
	grep: RegExp;

	instrumenterOptions: any;

	/** The path to Intern */
	internPath: string;

	/**
	 * The loader used to load test suites and application modules. When passed in as part of a config object, the
	 * `loader` property can be a string with a loader name or the path to a loader script. It may also be an object
	 * with `script` and `config` properties. Intern provides built-in loader scripts for Dojo and Dojo2, which can be
	 * specified with the IDs 'dojo' and 'dojo2'.
	 *
	 * ```ts
	 * loader: 'dojo2'
	 * loader: 'tests/loader.js'
	 * loader: { script: 'dojo', config: { packages: [ { name: 'app', location: './js' } ] } }
	 * ```
	 */
	loader: LoaderDescriptor;

	/** A top-level name for this configuration. */
	name: string;

	/**
	 * A list of scripts to load before suites are loaded. These must be simple scripts, not modules, as a module loader
	 * may not be available when these are loaded. Also, these scripts should be synchronous. If they need to run async
	 * actions, they can register listeners for the 'runBefore' or 'runAfter' executor events.
	 */
	plugins: PluginDescriptor[];

	/**
	 * A list of reporter names or descriptors. These reporters will be loaded and instantiated before testing begins.
	 */
	reporters: ReporterDescriptor[];

	/** If true, display the resolved config and exit */
	resolveConfig: boolean;

	/** A list of paths to suite scripts (or some other suite identifier usable by the suite loader). */
	suites: string[];
}

export interface ReporterDescriptor {
	name: string;
	options?: ReporterOptions;
}

export interface PluginDescriptor {
	script: string;
	options?: any;
}

export interface Listener<T> {
	(arg: T): void | Promise<void>;
}

export interface CoverageMessage {
	sessionId?: string;
	source?: string;
	coverage: any;
}

export interface DeprecationMessage {
	original: string;
	replacement?: string;
	message?: string;
}

export interface ExecutorEvent {
	name: keyof Events;
	data: any;
}

export interface Events {
	'*': ExecutorEvent;

	/** Emitted after the local executor has finished running suites */
	afterRun: never;

	/** Emitted before the local executor loads suites */
	beforeRun: never;

	/** Coverage info has been gathered */
	coverage: CoverageMessage;

	/** A deprecated method was called */
	deprecated: DeprecationMessage;

	/** An unhandled error occurs */
	error: Error;

	/** A debug log event */
	log: string;

	/** All tests have finished running */
	runEnd: never;

	/** Emitted just before tests start running  */
	runStart: never;

	/** A new suite has been added */
	suiteAdd: Suite;

	/** A suite has fininshed running */
	suiteEnd: Suite;

	/** A suite has started running */
	suiteStart: Suite;

	/** A new test has been added */
	testAdd: Test;

	/** A test has finished */
	testEnd: Test;

	/** A test has started */
	testStart: Test;
}

/**
 * An async loader callback. Intern will wait for the done callback to be called before proceeding.
 */
export interface Loader {
	(config: Config): Promise<void> | void;
}

export interface LoaderDescriptor {
	script: string;
	config?: { [key: string]: any };
}

export interface PluginInitializer {
	(options?: any): Task<object | void> | object | void;
}

const resolvedTask = Task.resolve();
