import * as chai from 'chai';
import { deepMixin, duplicate } from '@dojo/core/lang';
import { Handle } from '@dojo/interfaces/core';
import Task, { isThenable, State } from '@dojo/core/async/Task';
import global from '@dojo/shim/global';

import Suite from '../Suite';
import Test from '../Test';
import ErrorFormatter, { ErrorFormatOptions } from '../common/ErrorFormatter';
import {
	isTask,
	normalizePathEnding,
	parseValue,
	pullFromArray
} from '../common/util';
import Reporter, { ReporterOptions } from '../reporters/Reporter';
import {
	getInterface as getObjectInterface,
	ObjectInterface
} from '../interfaces/object';
import {
	getInterface as getTddInterface,
	TddInterface
} from '../interfaces/tdd';
import {
	getInterface as getBddInterface,
	BddInterface
} from '../interfaces/bdd';
import {
	getInterface as getBenchmarkInterface,
	BenchmarkInterface
} from '../interfaces/benchmark';
import { BenchmarkReporterOptions } from '../reporters/Benchmark';
import { InternError, RuntimeEnvironment } from '../types';
import * as console from '../common/console';

/**
 * This is the base executor class.
 *
 * Executors are the main driver of the testing process. An instance of Executor
 * is assigned to the `intern` global.
 */
export default abstract class Executor<
	E extends Events = Events,
	C extends Config = Config,
	P extends Plugins = Plugins
> {
	protected _assertions: { [name: string]: any };
	protected _config: C;
	protected _rootSuite: Suite;
	protected _events: Event<E>[];
	protected _errorFormatter: ErrorFormatter;
	protected _hasSuiteErrors = false;
	protected _hasTestErrors = false;
	protected _interfaces: { [name: string]: any };
	protected _loader: Loader;
	protected _loaderOptions: any;
	protected _loaderInit: Promise<Loader>;
	protected _loadingPlugins: { name: string; init: Task<void> }[];
	protected _loadingPluginOptions: any | undefined;
	protected _listeners: { [event: string]: Listener<any>[] };
	protected _plugins: { [name: string]: any };
	protected _reporters: Reporter[];
	protected _runTask: Task<void>;
	protected _reportersInitialized: boolean;

	constructor(options?: { [key in keyof C]?: any }) {
		this._config = <C>{
			bail: false,
			baseline: false,
			benchmark: false,
			browser: {
				plugins: <PluginDescriptor[]>[],
				reporters: <ReporterDescriptor[]>[],
				suites: <string[]>[]
			},
			coverageVariable: '__coverage__',
			debug: false,
			defaultTimeout: 30000,
			filterErrorStack: false,
			grep: new RegExp(''),
			loader: { script: 'default' },
			name: 'intern',
			node: {
				plugins: <PluginDescriptor[]>[],
				reporters: <ReporterDescriptor[]>[],
				suites: <string[]>[]
			},
			plugins: <PluginDescriptor[]>[],
			reporters: <ReporterDescriptor[]>[],
			sessionId: '',
			suites: <string[]>[]
		};

		this._reportersInitialized = false;
		this._events = [];
		this._listeners = {};
		this._reporters = [];
		this._plugins = {};
		this._loadingPlugins = [];

		this.registerInterface('object', getObjectInterface(this));
		this.registerInterface('tdd', getTddInterface(this));
		this.registerInterface('bdd', getBddInterface(this));
		this.registerInterface('benchmark', getBenchmarkInterface(this));

		this.registerPlugin('chai', () => chai);

		if (options) {
			this.configure(options);
		}

		this._rootSuite = new Suite({ executor: this });

		// This is the first suiteEnd listener. When the root unit test suite
		// ends, it will emit a coverage message before any other suiteEnd
		// listeners are called.
		this.on('suiteEnd', suite => {
			if (suite.error) {
				this._hasSuiteErrors = true;
			}
			if (!suite.hasParent && !suite.sessionId) {
				return this._emitCoverage('unit tests');
			}
		});

		this.on('testEnd', test => {
			if (test.error) {
				this._hasTestErrors = true;
			}
		});
	}

	/**
	 * Get the current enviroment
	 */
	abstract get environment(): RuntimeEnvironment;

	/**
	 * The resolved configuration for this executor.
	 */
	get config() {
		return this._config;
	}

	/**
	 * The root suites managed by this executor
	 */
	get suites() {
		return [this._rootSuite];
	}

	/**
	 * Format an error, normalizing the stack trace and resolving source map
	 * references
	 */
	formatError(error: Error, options?: ErrorFormatOptions) {
		if (!this._errorFormatter) {
			this._errorFormatter = new ErrorFormatter(this);
		}
		return this._errorFormatter.format(error, options);
	}

	/**
	 * Load a script or scripts. This is a convenience method for loading and
	 * evaluating simple scripts, not necessarily modules. If multiple script
	 * paths are provided, scripts will be loaded sequentially in the order
	 * given.
	 *
	 * @param script a path to a script
	 */
	abstract loadScript(script: string | string[]): Task<void>;

	/**
	 * Add a suite to the set of suites that will be run when `run` is called.
	 *
	 * The suite is added by calling a factory function. The use of a factory
	 * allows for distinct instances of a given suite to be create when an
	 * executor has multiple root suites.
	 *
	 * ```js
	 * intern.addSuite(parent => {
	 *     const suite = new Suite({
	 *         name: 'create new',
	 *         tests: [
	 *             new Test({
	 *                 name: 'new test',
	 *                 test: () => assert.doesNotThrow(() => new Component())
	 *             })
	 *         ]
	 *     });
	 *     parent.add(suite);
	 * });
	 * ```
	 *
	 * @param factory A function that will add a new Suite object to a given
	 * parent suite.
	 */
	addSuite(factory: (parentSuite: Suite) => void) {
		factory(this._rootSuite);
	}

	/**
	 * Configure the executor with an object containing
	 * [[lib/executors/Executor.Config]] properties.
	 */
	configure(options: { [key in keyof C]?: any }) {
		options = options || {};
		Object.keys(options).forEach((key: keyof C) => {
			const { name, addToExisting } = this._evalProperty(key);
			this._processOption(<keyof C>name, options[key], addToExisting);
		});
	}

	/**
	 * Emit an event to all registered listeners.
	 *
	 * Event listeners may execute async code, and a failing handler (one that
	 * rejects or throws an error) will cause the emit to fail.
	 *
	 * @param eventName the name of the event to emit
	 * @param data a data object whose type is event-dependent
	 * @returns a Task that resolves when all listeners have processed the event
	 */
	emit(eventName: 'afterRun'): Task<void>;
	emit(eventName: 'beforeRun'): Task<void>;
	emit(eventName: 'runStart'): Task<void>;
	emit(eventName: 'runEnd'): Task<void>;
	emit<T extends keyof E>(eventName: T, data: E[T]): Task<void>;
	emit<T extends keyof E>(eventName: T, data?: E[T]) {
		// If reporters haven't been loaded yet, queue the event for later
		if (!this._reportersInitialized) {
			this._events.push({ eventName, data });
			return Task.resolve();
		}

		const notifications: Promise<any>[] = [];

		(this._listeners[eventName] || []).forEach(listener => {
			notifications.push(Task.resolve(listener(data)));
		});

		const starListeners = this._listeners['*'] || [];
		if (starListeners.length > 0) {
			const starEvent = { name: eventName, data };
			starListeners.forEach(listener => {
				notifications.push(Task.resolve(listener(starEvent)));
			});
		}

		let error: InternError | undefined;
		if (eventName === 'error') {
			error = <InternError>data;
		}

		if (notifications.length === 0) {
			// If reporters haven't been loaded yet, cache the event
			if (error) {
				// Report errors, warnings, deprecation messages when no listeners are registered
				error.reported = true;
				console.error(this.formatError(error));
			} else if (eventName === 'warning') {
				console.warn(`WARNING: ${data}`);
			} else if (eventName === 'deprecated') {
				const message = <DeprecationMessage>data;
				console.warn(
					`WARNING: ${message.original} is deprecated, use ${message.replacement} instead.`
				);
			}

			return Task.resolve();
		}

		return Task.all<void>(notifications).then(() => {
			if (error) {
				error.reported = true;
			}
		});
	}

	/**
	 * Get a registered interface plugin.
	 *
	 * This method calls `getPlugin` behind the scenes.
	 *
	 * @param name the name of the interface
	 * @returns the interface, which may be an object or a callable function, or
	 * undefined if no such interface was registered.
	 */
	getInterface(name: 'object'): ObjectInterface;
	getInterface(name: 'tdd'): TddInterface;
	getInterface(name: 'bdd'): BddInterface;
	getInterface(name: 'benchmark'): BenchmarkInterface;
	getInterface(name: string): any {
		return this.getPlugin(`interface.${name}`);
	}

	/**
	 * Get any resources registered by a particular plugin.
	 *
	 * @param type the type of plugin (e.g., 'interface' or 'reporter')
	 * @param name the name of the plugin
	 * @returns the resource registered for the given plugin name, or undefined
	 * if no such plugin was registered.
	 */
	getPlugin<Y extends keyof P>(type: Y, name: string): P[Y];
	getPlugin(name: 'chai'): Chai.ChaiStatic;
	getPlugin(name: 'interface.object'): ObjectInterface;
	getPlugin(name: 'interface.tdd'): TddInterface;
	getPlugin(name: 'interface.bdd'): BddInterface;
	getPlugin(name: 'interface.benchmark'): BenchmarkInterface;
	getPlugin<T>(name: string): T;
	getPlugin<T>(type: string, name?: string): T {
		const pluginName =
			typeof name === 'undefined' ? type : `${type}.${name}`;

		if (!(pluginName in this._plugins)) {
			throw new Error(
				`A plugin named "${pluginName}" has not been registered`
			);
		}

		return <T>this._plugins[pluginName];
	}

	/**
	 * This is a convenience method for emitting log events.
	 *
	 * When debug mode is enabled, this method emits 'log' events using `emit`.
	 * Otherwise it does nothing.
	 *
	 * @param args A list of arguments that will be stringified and combined
	 * into a space-separated message.
	 * @returns a Task that resolves when all listeners have finished processing
	 * the event.
	 */
	log(...args: any[]) {
		if (this.config.debug) {
			const message = args
				.map(arg => {
					const type = typeof arg;
					if (type === 'string') {
						return arg;
					}
					if (type === 'function' || arg instanceof RegExp) {
						return arg.toString();
					}
					if (arg instanceof Error) {
						arg = {
							name: arg.name,
							message: arg.message,
							stack: arg.stack
						};
					}
					try {
						return JSON.stringify(arg);
					} catch (error) {
						return arg.toString();
					}
				})
				.join(' ');
			return this.emit('log', message);
		} else {
			return Task.resolve();
		}
	}

	/**
	 * Add a listener for a test event.
	 *
	 * ```js
	 * intern.on('error', error => {
	 *     console.log('An error occurred:', error);
	 * });
	 * ```
	 *
	 * A listener can be notified of all events by registering for the '*'
	 * event, or by calling on with only a callback:
	 *
	 * ```js
	 * intern.on(event => {
	 *     console.log(`An ${event.name} event occurred:`, event.data);
	 * });
	 * ```
	 * Note that some events are executor-specific. For example, the
	 * [[lib/executors/Browser]] executor will never emit a tunnelStop
	 * message.
	 *
	 * @param eventName the [[lib/executors/Executor.Events|event]] to listen
	 * for
	 * @param listener a callback that accepts a single data parameter; it may
	 * return a PromiseLike object if it needs to perform async actions
	 * @returns a handle with a `destroy` method that can be used to stop
	 * listening
	 */
	on<T extends keyof E>(eventName: T, listener: Listener<E[T]>): Handle;
	on(listener: Listener<{ name: string; data?: any }>): Handle;
	on<T extends keyof E>(
		eventName: T | Listener<any>,
		listener?: Listener<E[T]>
	) {
		let _eventName: T;
		if (typeof listener === 'undefined') {
			listener = <Listener<any>>eventName;
			_eventName = <T>'*';
		} else {
			_eventName = <T>eventName;
		}
		let listeners = this._listeners[_eventName];
		if (!listeners) {
			listeners = this._listeners[_eventName] = [];
		}

		if (listeners.indexOf(listener) === -1) {
			listeners.push(listener);
		}

		const handle: Handle = {
			destroy(this: any) {
				this.destroy = function() {};
				pullFromArray(listeners, listener);
			}
		};
		return handle;
	}

	/**
	 * Register an interface plugin
	 *
	 * This is a convenience method for registering test interfaces. This method
	 * calls [[lib/executors/Executor.Executor.registerPlugin]] behind the
	 * scenes using the name `interface.${name}`.
	 */
	registerInterface(name: string, iface: any) {
		this.registerPlugin(`interface.${name}`, () => iface);
	}

	/**
	 * Register a module loader.
	 *
	 * This method sets the loader script that will be used to load plugins and
	 * suites. The callback should accept an options object and return a
	 * function that can load modules.
	 *
	 * ```js
	 * intern.registerLoader(options: any => {
	 *     // Register loader can return a Promise if it needs to load something
	 *     // itself
	 *     return intern.loadScript('some/loader.js').then(() => {
	 *         loader.config(options);
	 *         // Return a function that takes a list of modules and returns a
	 *         // Promise that resolves when they've been loaded.
	 *         return (modules: string[]) => {
	 *             return loader.load(modules);
	 *         });
	 *     });
	 * });
	 * ```
	 *
	 * @param init a loader initialzation callback that should return a loader
	 * function, or a Promise that resolves to a loader function
	 */
	registerLoader(init: LoaderInit) {
		const options = this._loaderOptions
			? duplicate(this._loaderOptions)
			: {};
		this._loaderInit = Promise.resolve(init(options));
	}

	/**
	 * Register a plugin.
	 *
	 * Plugins are resources that are loaded at the beginning of the testing
	 * process, after the loader but before any suites are registered. The
	 * callback may return a Promise if the plugin needs to do some asynchronous
	 * initialization. If the plugin is being loaded via the
	 * [[lib/executors/Executor.Config.plugins|config.plugins]]
	 * property, it's init callback will be passed any configured options. The
	 * resolved return value of the callback will be returned by
	 * [[lib/executors/Executor.Executor.getPlugin]].
	 *
	 * ```js
	 * intern.registerPlugin('foo', (options: any) => {
	 *     return {
	 *         doSomething() {
	 *             // ...
	 *         },
	 *         doSomethingElse() {
	 *             // ...
	 *         }
	 *     };
	 * });
	 * ```
	 *
	 * Code would use the plugin by calling getPlugin:
	 *
	 * ```js
	 * const { doSomething, doSomethingElse } = intern.getPlugin('foo');
	 * doSomething();
	 * ```
	 *
	 * @param name the plugin name
	 * @param init an initializer function that returns the plugin resource, or
	 * a Promise that resolves to the resource
	 */
	registerPlugin<T extends keyof P>(
		type: T,
		name: string,
		init: PluginInitializer<P[T]>
	): void;
	registerPlugin(name: string, init: PluginInitializer): void;
	registerPlugin(
		type: string,
		name: string | PluginInitializer,
		init?: PluginInitializer
	) {
		const pluginName =
			typeof init === 'undefined' ? type : `${type}.${name}`;
		const pluginInit =
			typeof init === 'undefined' ? <PluginInitializer>name : init;
		const options = this._loadingPluginOptions;
		const result = options ? pluginInit(duplicate(options)) : pluginInit();
		if (isThenable(result)) {
			// If the result is thenable, push it on the loading queue
			this._loadingPlugins.push({
				name: pluginName,
				init: new Task<any>(
					(resolve, reject) =>
						result.then(value => resolve(value), reject),
					() => {
						isTask(result) && result.cancel();
					}
				)
			});
		} else {
			// If the result is not thenable, immediately add it to the plugins
			// list
			this._assignPlugin(pluginName, result);
		}
	}

	/**
	 * Register a reporter plugin
	 *
	 * This is a convenience method for registering reporter constructors. This
	 * method calls [[lib/executors/Executor.Executor.registerPlugin]] behind
	 * the scenes using the name `reporter.${name}`.
	 *
	 * @param name the reporter name
	 * @param Ctor a reporter class constructor
	 */
	registerReporter(name: string, Ctor: typeof Reporter) {
		this.registerPlugin('reporter', name, () => Ctor);
	}

	/**
	 * Run tests.
	 *
	 * This method sets up the environment for test execution, runs the tests,
	 * and runs any finalization code afterwards.
	 */
	run() {
		// Only allow the executor to be started once
		if (!this._runTask) {
			let runError: Error;

			try {
				this._runTask = this._resolveConfig().then(() =>
					this._initReporters()
				);

				if (this.config.showConfig) {
					this._runTask = this._runTask
						.then(() => {
							// Emit the config as JSON deeply sorted by key
							const sort = (value: any) => {
								if (Array.isArray(value)) {
									value = value.map(sort).sort();
								} else if (typeof value === 'object') {
									const newObj: { [key: string]: any } = {};
									Object.keys(value)
										.sort()
										.forEach(key => {
											newObj[key] = sort(value[key]);
										});
									value = newObj;
								}
								return value;
							};
							console.log(
								JSON.stringify(sort(this.config), null, '    ')
							);
						})
						.catch(error => {
							// Display resolution errors because reporters
							// haven't been installed yet
							console.error(this.formatError(error));
							throw error;
						});
				} else {
					let currentTask: Task<void>;

					this._runTask = this._runTask
						.then(() => this._loadPlugins())
						.then(() => this._loadLoader())
						.then(() => this._loadPluginsWithLoader())
						.then(() => this._loadSuites())
						.then(() => this._beforeRun())
						.then((skipTests: boolean) => {
							if (skipTests) {
								return;
							}

							// Keep track of distinct tasks to allow them to be
							// cancelled
							let outerTask: Task<void>;
							let testingTask: Task<void>;

							currentTask = new Task<void>(
								(resolve, reject) => {
									outerTask = this.emit('beforeRun')
										.then(() => {
											return this.emit('runStart')
												.then(
													() =>
														(testingTask = this._runTests())
												)
												.catch(error => {
													runError = error;
													return this.emit(
														'error',
														error
													);
												})
												.finally(() =>
													this.emit('runEnd')
												);
										})
										.finally(() => this.emit('afterRun'))
										.then(resolve, reject);
								},
								() => {
									if (
										testingTask &&
										testingTask.state === State.Pending
									) {
										testingTask.cancel();
									} else if (
										outerTask &&
										outerTask.state === State.Pending
									) {
										outerTask.cancel();
									}
								}
							);
							return currentTask;
						})
						.finally(() => {
							// Ensure any queued events have been emitted.
							this._reportersInitialized = true;
							return this._drainEventQueue();
						})
						.finally(() => this._afterRun())
						.finally(() => {
							if (
								currentTask &&
								currentTask.state === State.Pending
							) {
								currentTask.cancel();
							}
						})
						.catch(error => {
							return this.emit('error', error).finally(() => {
								// A runError has priority over any cleanup
								// errors, so rethrow one if it exists.
								throw runError || error;
							});
						})
						.then(() => {
							// If we didn't have any cleanup errors but a
							// runError was caught, throw it to reject the run
							// task
							if (runError) {
								throw runError;
							}

							let message = '';

							// If there were no run errors but any suites had
							// errors, throw an error to reject the run task.
							if (this._hasSuiteErrors) {
								message =
									'One or more suite errors occurred during testing';
							} else if (this._hasTestErrors) {
								// If there were no run errors but any tests
								// failed, throw an error to reject the run
								// task.
								message = 'One or more tests failed';
							}

							if (message) {
								const error: InternError = new Error(message);
								// Mark this error as reported so that the
								// runner script won't report it again.
								error.reported = true;
								throw error;
							}
						});
				}
			} catch (error) {
				this._runTask = this.emit('error', error).then(() => {
					return Task.reject<void>(error);
				});
			}
		}

		return this._runTask;
	}

	/**
	 * Code to execute after the main test run has finished to shut down the test system.
	 */
	protected _afterRun() {
		return Task.resolve();
	}

	/**
	 * Add a resolved plugin to the internal plugins list
	 */
	protected _assignPlugin(name: string, plugin: any) {
		if (name.indexOf('reporter.') === 0 && typeof plugin !== 'function') {
			throw new Error('A reporter plugin must be a constructor');
		}
		this._plugins[name] = plugin;
	}

	/**
	 * Code to execute before the main test run has started to set up the test
	 * system. This is where Executors can do any last-minute configuration
	 * before the testing process begins.
	 *
	 * This method returns a Task that resolves to a boolean. A value of true
	 * indicates that Intern should skip running tests and exit normally.
	 */
	protected _beforeRun() {
		const { bail, grep, name, sessionId, defaultTimeout } = this.config;
		this._rootSuite.bail = bail;
		this._rootSuite.grep = grep;
		this._rootSuite.name = name;
		this._rootSuite.sessionId = sessionId;
		this._rootSuite.timeout = defaultTimeout;
		return Task.resolve(false);
	}

	/**
	 * Instantiate any configured built-in reporters
	 */
	protected _initReporters() {
		const config = this.config;
		const envReporters = config[this.environment].reporters;

		// Take reporters from the base config that aren't also specified in an
		// environment config
		const baseReporters = config.reporters.filter(reporter => {
			return !envReporters.some(
				envReporter => envReporter.name === reporter.name
			);
		});

		for (const reporter of [...baseReporters, ...envReporters]) {
			const ReporterClass = this.getPlugin('reporter', reporter.name);
			if (!ReporterClass) {
				throw new Error(
					`A reporter named ${reporter.name} hasn't been registered`
				);
			}
			if (typeof ReporterClass !== 'function') {
				throw new Error(
					`The reporter ${reporter.name} isn't a valid constructor`
				);
			}
			this._reporters.push(new ReporterClass(this, reporter.options));
		}

		this._reportersInitialized = true;

		return this._drainEventQueue();
	}

	/**
	 * Emit any queued events. The event queue will be empty after this method
	 * runs.
	 */
	protected _drainEventQueue() {
		let task = Task.resolve();
		while (this._events.length > 0) {
			const event = this._events.shift()!;
			task = task.then(() => {
				return this.emit(event.eventName, event.data);
			});
		}
		return task;
	}

	protected _emitCoverage(source?: string) {
		const coverage = global[this.config.coverageVariable];
		if (coverage) {
			return this.emit('coverage', {
				coverage,
				source,
				sessionId: this.config.sessionId
			});
		}
	}

	/**
	 * Evaluate a config property key
	 */
	protected _evalProperty(key: string): EvaluatedProperty<C> {
		const addToExisting = key[key.length - 1] === '+';
		const name = <keyof C>(addToExisting
			? <keyof C>key.slice(0, key.length - 1)
			: key);
		return { name, addToExisting };
	}

	/**
	 * Load a loader
	 */
	protected _loadLoader() {
		// If registerLoader was already called, just wait for that loader to
		// initialize
		if (this._loaderInit) {
			return this._loaderInit.then(loader => {
				this._loader = loader;
			});
		} else {
			// No loader has been registered, so load the configured or default
			// one
			const config = this.config;
			const loader: { [key: string]: any } =
				config[this.environment].loader || config.loader;

			let script = loader.script;
			switch (script) {
				case 'default':
				case 'dojo':
				case 'dojo2':
				case 'esm':
				case 'systemjs':
					script = `${config.internPath}loaders/${script}.js`;
			}

			this._loaderOptions = loader.options || {};
			return this.loadScript(script)
				.then(() => {
					if (!this._loaderInit) {
						throw new Error(
							`Loader script ${script} did not register a loader callback`
						);
					}
					return this._loaderInit;
				})
				.then(loader => {
					this._loader = loader;
				});
		}
	}

	/**
	 * Load scripts in the `requires` list using an external loader, if
	 * configured, or the platform's native loading mechanism
	 */
	protected _loadPluginsWithLoader() {
		const scripts = [
			...this.config.plugins,
			...this.config[this.environment].plugins
		].filter(plugin => plugin.useLoader);
		return this._loadScripts(scripts, script => this._loader([script]));
	}

	/**
	 * Load scripts in the `plugins` list using the platform's native loading
	 * mechanism
	 */
	protected _loadPlugins() {
		const scripts = [
			...this.config.plugins,
			...this.config[this.environment].plugins
		].filter(plugin => !plugin.useLoader);
		return this._loadScripts(scripts, script => this.loadScript(script));
	}

	/**
	 * Load a list of scripts using a given loader. These will be loaded
	 * sequentially in order.
	 */
	protected _loadScripts(
		scripts: PluginDescriptor[],
		loader: (script: string) => Promise<void>
	) {
		return scripts
			.reduce((previous, script) => {
				if (typeof script === 'string') {
					return previous.then(() => loader(script));
				} else {
					this._loadingPluginOptions = script.options;
					return previous
						.then(() => loader(script.script))
						.then(() => {
							this._loadingPluginOptions = undefined;
						});
				}
			}, Task.resolve())
			.then(() => {
				// Wait for all plugin registrations, both configured ones and
				// any that were manually registered, to resolve
				return Task.all(
					this._loadingPlugins.map(entry => entry.init)
				).then(plugins => {
					plugins.forEach((plugin, index) => {
						this._assignPlugin(
							this._loadingPlugins[index].name,
							plugin
						);
					});
				});
			});
	}

	/**
	 * Load suites
	 */
	protected _loadSuites() {
		// _resolveSuites will expand all suites into <env>.suites for the
		// current env
		const suites = this.config[this.environment].suites;
		return Task.resolve(this._loader(suites!)).then(() => {
			this.log('Loaded suites:', suites);
		});
	}

	/**
	 * Process an arbitrary config value. Subclasses can override this method to
	 * pre-process arguments or handle them instead of allowing Executor to.
	 */
	protected _processOption(
		name: keyof C,
		value: any,
		addToExisting: boolean
	) {
		switch (name) {
			case 'loader':
				this._setOption(
					name,
					parseValue(name, value, 'object', 'script')
				);
				break;

			case 'bail':
			case 'baseline':
			case 'benchmark':
			case 'debug':
			case 'filterErrorStack':
			case 'showConfig':
				this._setOption(name, parseValue(name, value, 'boolean'));
				break;

			case 'basePath':
			case 'coverageVariable':
			case 'description':
			case 'internPath':
			case 'name':
			case 'sessionId':
				this._setOption(name, parseValue(name, value, 'string'));
				break;

			case 'defaultTimeout':
				this._setOption(name, parseValue(name, value, 'number'));
				break;

			case 'grep':
				this._setOption(name, parseValue(name, value, 'regexp'));
				break;

			case 'reporters':
				this._setOption(
					name,
					parseValue(name, value, 'object[]', 'name'),
					addToExisting
				);
				break;

			case 'plugins':
			case 'requires':
			case 'require':
			case 'scripts':
				let useLoader = false;
				if (name === 'scripts') {
					this.emit('deprecated', {
						original: 'scripts',
						replacement: 'plugins'
					});
					name = 'plugins';
				} else if (name === 'require') {
					this.emit('deprecated', {
						original: 'require',
						replacement: 'plugins'
					});
					name = 'plugins';
				} else if (name === 'requires') {
					this.emit('deprecated', {
						original: 'require',
						replacement: 'plugins',
						message: 'Set `useLoader: true`'
					});
					name = 'plugins';
					useLoader = true;
				}
				const parsed = parseValue(name, value, 'object[]', 'script');
				if (useLoader) {
					parsed.forEach((entry: PluginDescriptor) => {
						entry.useLoader = true;
					});
				}
				this._setOption(name, parsed, addToExisting);
				break;

			case 'suites':
				this._setOption(
					name,
					parseValue(name, value, 'string[]'),
					addToExisting
				);
				break;

			case 'node':
			case 'browser':
				const envConfig: ResourceConfig = this.config[name];
				const envName = name;
				value = parseValue(name, value, 'object');
				if (value) {
					Object.keys(value).forEach((key: keyof ResourceConfig) => {
						let resource = value[key];
						let { name, addToExisting } = this._evalProperty(key);
						switch (name) {
							case 'loader':
								resource = parseValue(
									name,
									resource,
									'object',
									'script'
								);
								this._setOption(
									name,
									resource,
									false,
									<C>envConfig
								);
								break;
							case 'reporters':
								resource = parseValue(
									'reporters',
									resource,
									'object[]',
									'name'
								);
								this._setOption(
									name,
									resource,
									addToExisting,
									<C>envConfig
								);
								break;
							case 'plugins':
							case 'require':
							case 'requires':
							case 'scripts':
								let useLoader = false;
								if (name === 'scripts') {
									this.emit('deprecated', {
										original: 'scripts',
										replacement: 'plugins'
									});
									name = 'plugins';
								} else if (name === 'require') {
									this.emit('deprecated', {
										original: 'require',
										replacement: 'plugins'
									});
									name = 'plugins';
								} else if (name === 'requires') {
									this.emit('deprecated', {
										original: 'requires',
										replacement: 'plugins',
										message: 'Set `useLoader: true`'
									});
									name = 'plugins';
									useLoader = true;
								}
								resource = parseValue(
									name,
									resource,
									'object[]',
									'script'
								);
								if (useLoader) {
									resource.forEach(
										(entry: PluginDescriptor) => {
											entry.useLoader = true;
										}
									);
								}
								this._setOption(
									name,
									resource,
									addToExisting,
									<C>envConfig
								);
								break;
							case 'suites':
								resource = parseValue(
									name,
									resource,
									'string[]'
								);
								this._setOption(
									name,
									resource,
									addToExisting,
									<C>envConfig
								);
								break;
							default:
								throw new Error(
									`Invalid property ${key} in ${envName} config`
								);
						}
					});
				}
				break;

			default:
				console.warn(`Config has unknown option "${name}"`);
				this._setOption(name, value);
		}
	}

	/**
	 * Set an option value.
	 */
	protected _setOption(
		name: keyof C,
		value: any,
		addToExisting = false,
		config?: C
	) {
		config = config || this.config;

		// addToExisting
		if (addToExisting) {
			const currentValue: any[] = config[name];
			currentValue.push(...value);
		} else {
			config[name] = value;
		}
	}

	/**
	 * Resolve the config object.
	 */
	protected _resolveConfig() {
		const config = this.config;

		if (config.internPath != null) {
			config.internPath = normalizePathEnding(config.internPath);
		} else {
			config.internPath = '';
		}

		if (config.benchmark) {
			config.benchmarkConfig = deepMixin(
				<BenchmarkConfig>{
					mode: config.baseline ? 'baseline' : 'test',
					id: 'Benchmark',
					filename: 'baseline.json',
					thresholds: {
						warn: { rme: 3, mean: 5 },
						fail: { rme: 6, mean: 10 }
					},
					verbosity: 0
				},
				config.benchmarkConfig || {}
			);
		}

		return Task.resolve();
	}

	/**
	 * Runs each of the root suites, limited to a certain number of suites at
	 * the same time by `maxConcurrency`.
	 */
	protected _runTests() {
		return this._rootSuite.run();
	}
}

export interface Event<E extends Events = Events> {
	eventName: keyof E;
	data?: any;
}

export interface ExecutorConstructor<
	E extends Events,
	C extends Config,
	T extends Executor<E, C>
> {
	new (config?: Partial<C>): T;
}

export { Handle };

export interface BenchmarkConfig extends BenchmarkReporterOptions {
	id: string;
}

export interface ResourceConfig {
	/**
	 * The loader used to load test suites and application modules.
	 *
	 * When passed in as part of a config object, the `loader` property can be a
	 * string with a loader name or the path to a loader script. It may also be
	 * an object with `script` and `config` properties. Intern provides built-in
	 * loader scripts for Dojo and Dojo2, which can be specified with the IDs
	 * 'dojo' and 'dojo2'.
	 *
	 * ```ts
	 * loader: 'dojo2'
	 * loader: 'tests/loader.js'
	 * loader: {
	 *     script: 'dojo',
	 *     config: {
	 *         packages: [
	 *             { name: 'app', location: './js' }
	 *         ]
	 *     }
	 * }
	 * ```
	 */
	loader: LoaderDescriptor;

	/**
	 * A list of reporter names or descriptors.
	 *
	 * Reporters specified in this list must have been previously installed
	 * using
	 * [`registerReporter`](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/registerreporter)
	 * or
	 * [`registerPlugin`](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/registerplugin).
	 *
	 * List entries may be reporter names or objects of the format
	 *
	 * ```js
	 * {
	 *     name: 'reporter name',
	 *     options: {
	 *         // reporter-specific options
	 *     }
	 * }
	 * ```
	 */
	reporters: ReporterDescriptor[];

	/**
	 * A list of scripts or modules to load before suites are loaded.
	 */
	plugins: PluginDescriptor[];

	/**
	 * A list of paths or glob expressions that point to suite scripts.
	 *
	 * ```js
	 * {
	 *     suites: [
	 *         'tests/unit/**\/*.js',
	 *         'tests/intergration/request.js'
	 *     ]
	 * }
	 * ```
	 *
	 * Note that using globs with the browser client requires that Intern's
	 * server be used to serve the tests. The server can be run in standalone
	 * mode by setting the `serveOnly` option.
	 */
	suites: string[];
}

/**
 * This interface describes the configuration data used by Intern. Its
 * properties can be set from the command line when running the intern bin
 * script, or via an object passed to the executor's
 * [[lib/executors/Executor.Executor.configure]] method.
 */
export interface Config extends ResourceConfig {
	/**
	 * By default, Intern will run all configured tests. Setting this option
	 * to `true` will cause Intern to stop running tests after the first failure.
	 */
	bail: boolean;

	baseline: boolean;

	/** The path to the project base */
	basePath: string;

	/**
	 * This property must be set to `true` for benchmark tests to run. If it is
	 * unset or `false`, any suites registered using the benchmark interface will
	 * be ignored.
	 */
	benchmark: boolean;

	benchmarkConfig?: BenchmarkConfig;

	browser: ResourceConfig;

	/**
	 * The global variable that will be used to store coverage data
	 */
	coverageVariable: string;

	/**
	 * When set to true, Intern will emit 'log' events for many internal
	 * operations. Reporters that register for these events, such as the Runner
	 * reporter, will display them during testing.
	 */
	debug: boolean;

	/**
	 * This is the number of milliseconds that Intern will wait for an
	 * [asynchronous test](https://github.com/theintern/intern/docs/writing_tests.md#testing-asynchronous-code)
	 * to complete before timing out. A timed out test is considered to have
	 * failed.
	 */
	defaultTimeout: number;

	/** A description for this test run */
	description: string;

	/**
	 * If true, filter external library calls and runtime calls out of error
	 * stacks.
	 */
	filterErrorStack: boolean;

	/**
	 * This property is a regular expression that is used to filter which tests
	 * are run. Grep operates on test IDs. A test ID is the concatenation of a
	 * test name with all of its parent suite names. Every test ID that matches
	 * the current grep expression will be run.
	 */
	grep: RegExp;

	/** The path to Intern */
	internPath: string;

	/** A top-level name for this configuration. */
	name: string;

	node: ResourceConfig;

	/**
	 * An identifier for this test session. By default it will have the value
	 * ''.
	 */
	sessionId: string;

	/** If true, display the resolved config and exit */
	showConfig: boolean;
}

/**
 * A descriptor object used to load a built-in reporter
 */
export interface ReporterDescriptor {
	name: string;
	options?: ReporterOptions;
}

/**
 * A descriptor object for a script. If an options value is present, the
 * descriptor is assumed to refer to a plugin, and the options will be passed to
 * the plugins initializer function.
 */
export interface PluginDescriptor {
	script: string;
	useLoader?: boolean;
	options?: any;
}

/**
 * A generic event listener
 */
export interface Listener<T> {
	(arg: T): void | Promise<void>;
}

/**
 * The data accompanying a coverage event
 */
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

/**
 * Events that may be emitted by an Executor. Each event has at most one
 * associated message type. A few (e.g., afterRun) don't have messages.
 */
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

	/** A non-fatal error occurred */
	warning: string;
}

/**
 * Known plugin types
 */
export interface Plugins {
	reporter: typeof Reporter;
}

/**
 * An async loader callback.
 */
export interface Loader {
	(modules: string[]): Promise<void>;
}

/**
 * A loader initialization function.
 */
export interface LoaderInit {
	(options: { [key: string]: any }): Promise<Loader> | Loader;
}

export interface LoaderDescriptor {
	script: string;
	options?: { [key: string]: any };
}

export interface PluginInitializer<T extends any = any> {
	(options?: { [key: string]: any }): Task<T> | T;
}

export interface EvaluatedProperty<C extends Config = Config> {
	name: keyof C;
	addToExisting: boolean;
}
