import * as chai from 'chai';
import {
  Handle,
  deepMixin,
  duplicate,
  Task,
  CancellablePromise,
  isPromiseLike,
  isTask,
  global
} from '../../../common';

import Suite from '../Suite';
import Test from '../Test';
import ErrorFormatter, { ErrorFormatOptions } from '../common/ErrorFormatter';
import {
  BenchmarkConfig,
  Config,
  PluginDescriptor,
  ReporterDescriptor
} from '../common/config';
import { normalizePathEnding } from '../common/path';
import { processOption, pullFromArray } from '../common/util';
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
import { InternError, RuntimeEnvironment } from '../types';
import * as console from '../common/console';

/**
 * This interface represents the core functionality of an Executor
 */
export interface Executor {
  readonly config: Config;
  readonly suites: Suite[];

  addSuite(factory: (parentSuite: Suite) => void): void;

  configure(options: { [key: string]: any }): void;

  emit<T extends NoDataEvents>(eventName: T): CancellablePromise<void>;
  emit<T extends keyof Events>(
    eventName: T,
    data: Events[T]
  ): CancellablePromise<void>;

  formatError(error: Error, options?: ErrorFormatOptions): string;

  log(...args: any[]): CancellablePromise<void>;

  on<T extends keyof Events>(
    eventName: T,
    listener: Listener<Events[T]>
  ): Handle;
  on(listener: Listener<{ name: string; data?: any }>): Handle;
}

/**
 * This is the base executor class.
 *
 * Executors are the main driver of the testing process. An instance of Executor
 * is assigned to the `intern` global.
 */
export default abstract class BaseExecutor<
  E extends Events,
  C extends Config,
  P extends Plugins
> implements Executor {
  protected _config: C;
  protected _rootSuite: Suite;
  protected _events: InternEvent<E>[];
  protected _errorFormatter: ErrorFormatter | undefined;
  protected _hasSuiteErrors = false;
  protected _hasTestErrors = false;
  protected _hasEmittedErrors = false;
  protected _loader!: Loader;
  protected _loaderOptions: any;
  protected _loaderInit: Promise<Loader> | undefined;
  protected _loadingPlugins: { name: string; init: CancellablePromise<void> }[];
  protected _loadingPluginOptions: any | undefined;
  protected _listeners: { [event: string]: Listener<any>[] };
  protected _plugins: { [name: string]: any };
  protected _reporters: Reporter[];
  protected _runTask: CancellablePromise<void> | undefined;
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
  formatError(error: Error, options?: ErrorFormatOptions): string {
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
  abstract loadScript(script: string | string[]): CancellablePromise<void>;

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
    Object.keys(options).forEach(option => {
      const key = <keyof C>option;
      this._processOption(key, options[key]);
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
   * @returns a CancellablePromise that resolves when all listeners have processed the event
   */
  emit<T extends NoDataEvents>(eventName: T): CancellablePromise<void>;
  emit<T extends keyof E>(eventName: T, data: E[T]): CancellablePromise<void>;
  emit<T extends keyof E>(eventName: T, data?: E[T]): CancellablePromise<void> {
    if (eventName === 'error') {
      this._hasEmittedErrors = true;
    }

    // Ignore log messages if not in debug mode
    if (eventName === 'log' && !this.config.debug) {
      return Task.resolve();
    }

    // If reporters haven't been loaded yet, queue the event for later
    if (!this._reportersInitialized) {
      this._events.push({ eventName, data });
      return Task.resolve();
    }

    // Handle the case when an error is emitted by an event listener. If
    // we're not already handling an error, emit a new error event. If we
    // are, then assume the error handler is broken and just console.error
    // the error.
    const handleListenerError = (error: Error) => {
      if (eventName === 'error') {
        console.error(this.formatError(error));
      } else {
        return this.emit('error', error);
      }
    };

    let error: InternError | undefined;
    if (eventName === 'error') {
      error = <any>data;
    }

    // If this is an error event, mark the error as 'reported'
    const handleErrorEvent = () => {
      if (error) {
        error.reported = true;
      }
    };

    let notifications = Task.resolve();
    let hasNotifications = false;

    // First, notify the listeners specifically listening for this event
    const listeners = this._listeners[<string>eventName];
    if (listeners && listeners.length > 0) {
      hasNotifications = true;
      for (const listener of listeners) {
        notifications = notifications
          .then(() => Task.resolve(listener(data)))
          .then(handleErrorEvent)
          .catch(handleListenerError);
      }
    }

    // Next, notify 'star' listeners, which listen for all events
    const starListeners = this._listeners['*'];
    if (starListeners && starListeners.length > 0) {
      hasNotifications = true;
      const starEvent = { name: eventName, data };
      for (const listener of starListeners) {
        notifications = notifications
          .then(() => Task.resolve(listener(starEvent)))
          .then(handleErrorEvent)
          .catch(handleListenerError);
      }
    }

    if (!hasNotifications) {
      // If reporters haven't been loaded yet, cache the event
      if (error) {
        // Report errors, warnings, deprecation messages when no
        // listeners are registered
        console.error(this.formatError(error));
        error.reported = true;
      } else if (eventName === 'warning') {
        console.warn(`WARNING: ${data}`);
      } else if (eventName === 'deprecated') {
        const message: Events['deprecated'] = <any>data!;
        console.warn(
          `WARNING: ${message.original} is deprecated, use ${message.replacement} instead.`
        );
      }

      return Task.resolve();
    }

    return notifications;
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
  getPlugin(name: 'chai'): typeof chai;
  getPlugin(name: 'interface.object'): ObjectInterface;
  getPlugin(name: 'interface.tdd'): TddInterface;
  getPlugin(name: 'interface.bdd'): BddInterface;
  getPlugin(name: 'interface.benchmark'): BenchmarkInterface;
  getPlugin<T>(name: string): T;
  getPlugin<T>(type: string, name?: string): T {
    const pluginName = typeof name === 'undefined' ? type : `${type}.${name}`;

    if (!(pluginName in this._plugins)) {
      throw new Error(`A plugin named "${pluginName}" has not been registered`);
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
   * @returns a CancellablePromise that resolves when all listeners have finished processing
   * the event.
   */
  log(...args: any[]): CancellablePromise<void> {
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
    let listeners = this._listeners[<string>_eventName];
    if (!listeners) {
      listeners = this._listeners[<string>_eventName] = [];
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
    const options = this._loaderOptions ? duplicate(this._loaderOptions) : {};
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
    const pluginName = typeof init === 'undefined' ? type : `${type}.${name}`;
    const pluginInit =
      typeof init === 'undefined' ? <PluginInitializer>name : init;
    const options = this._loadingPluginOptions;
    const result = options ? pluginInit(duplicate(options)) : pluginInit();
    if (isPromiseLike(result)) {
      // If the result is thenable, push it on the loading queue
      this._loadingPlugins.push({
        name: pluginName,
        init: new Task<any>(
          (resolve, reject) => result.then(value => resolve(value), reject),
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
  registerReporter(name: string, init: ReporterInitializer) {
    this.registerPlugin('reporter', name, () => init);
  }

  /**
   * Run tests.
   *
   * This method sets up the environment for test execution, runs the tests,
   * and runs any finalization code afterwards.
   */
  run(): CancellablePromise<void> {
    // Only allow the executor to be started once
    if (!this._runTask) {
      let runError: Error;

      try {
        this._runTask = this._resolveConfig();

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
              console.log(JSON.stringify(sort(this.config), null, '    '));
            })
            .catch(error => {
              // Display resolution errors because reporters
              // haven't been installed yet
              console.error(this.formatError(error));
              throw error;
            });
        } else {
          let currentTask: CancellablePromise<void>;

          this._runTask = this._runTask
            .then(() => this._loadPlugins())
            .then(() => this._loadLoader())
            .then(() => this._loadPluginsWithLoader())
            .then(() => this._initReporters())
            .then(() => this._loadSuites())
            .then(() => this._beforeRun())
            .then((skipTests: boolean) => {
              if (skipTests) {
                return;
              }

              // Keep track of distinct tasks to allow them to be
              // cancelled
              let outerTask: CancellablePromise<void>;
              let testingTask: CancellablePromise<void>;

              currentTask = new Task<void>(
                (resolve, reject) => {
                  outerTask = this.emit('beforeRun')
                    .then(() => {
                      return this.emit('runStart')
                        .then(() => (testingTask = this._runTests()))
                        .catch(error => {
                          runError = error;
                          return this.emit('error', error);
                        })
                        .finally(() => this.emit('runEnd'));
                    })
                    .finally(() => this.emit('afterRun'))
                    .then(resolve, reject);
                },
                () => {
                  if (testingTask) {
                    testingTask.cancel();
                  }
                  if (outerTask) {
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
              if (currentTask) {
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
                message = 'One or more suite errors occurred during testing';
              } else if (this._hasTestErrors) {
                // If there were no run errors but any tests
                // failed, throw an error to reject the run
                // task.
                message = 'One or more tests failed';
              } else if (this._hasEmittedErrors) {
                // If there were no test or suite errors, but
                // *some* error was emitted, throw an error to
                // reject the run task.
                message = 'An error was emitted';
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
   * Code to execute after the main test run has finished to shut down the test
   * system.
   */
  protected _afterRun(): CancellablePromise<void> {
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
   * This method returns a CancellablePromise that resolves to a boolean. A
   * value of true indicates that Intern should skip running tests and exit
   * normally.
   */
  protected _beforeRun(): CancellablePromise<boolean> {
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
      const initializer = this.getPlugin('reporter', reporter.name);
      if (!initializer) {
        throw new Error(
          `A reporter named ${reporter.name} hasn't been registered`
        );
      }
      if (typeof initializer !== 'function') {
        throw new Error(
          `The reporter ${reporter.name} isn't a valid initializer`
        );
      }
      this._reporters.push(initializer(reporter.options));
    }

    this._reportersInitialized = true;

    return this._drainEventQueue();
  }

  /**
   * Emit any queued events. The event queue will be empty after this method
   * runs.
   */
  protected _drainEventQueue(): CancellablePromise<void> {
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
          script = `${config.internPath}core/loaders/${script}.ts`;
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
  ): CancellablePromise<void> {
    return scripts
      .reduce((previous, script) => {
        if (typeof script === 'string') {
          return previous.then(() => loader(script));
        } else {
          return previous
            .then(() => {
              this._loadingPluginOptions = script.options;
            })
            .then(() => loader(script.script))
            .then(() => {
              this._loadingPluginOptions = undefined;
            });
        }
      }, Task.resolve())
      .then(() => {
        // Wait for all plugin registrations, both configured ones and
        // any that were manually registered, to resolve
        return Task.all(this._loadingPlugins.map(entry => entry.init)).then(
          plugins => {
            plugins.forEach((plugin, index) => {
              this._assignPlugin(this._loadingPlugins[index].name, plugin);
            });
          }
        );
      });
  }

  /**
   * Load suites
   */
  protected _loadSuites(): CancellablePromise<void> {
    // _resolveSuites will expand all suites into <env>.suites for the
    // current env
    const suites = this.config[this.environment].suites;
    return Task.resolve(this._loader(suites!)).then(() => {
      this.log('Loaded suites:', suites);
    });
  }

  /**
   * Process an option
   */
  protected _processOption(key: keyof C, value: any) {
    processOption(key, value, this.config, this);
  }

  /**
   * Resolve the config object.
   */
  protected _resolveConfig(): CancellablePromise<void> {
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
  protected _runTests(): CancellablePromise<void> {
    return this._rootSuite.run();
  }
}

export { BenchmarkConfig, Config, PluginDescriptor, ReporterDescriptor };

export interface InternEvent<E extends Events> {
  eventName: keyof E;
  data?: any;
}

export { Handle };

/**
 * A generic event listener
 */
export interface Listener<T> {
  (arg: T): void | Promise<any>;
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
  /** A listener can listen for this event to be notified of all events */
  '*': ExecutorEvent;

  /**
   * Emitted after the local executor has finished running suites. This is
   * functionally the same as runEnd.
   */
  afterRun: void;

  /** Emitted before the local executor loads suites */
  beforeRun: void;

  /** Coverage info has been gathered */
  coverage: CoverageMessage;

  /** A deprecated method was called */
  deprecated: DeprecationMessage;

  /** An unhandled error occurs */
  error: Error;

  /** A debug log event */
  log: string;

  /**
   * All tests have finished running. This is functionally the same as
   * afterRun.
   */
  runEnd: void;

  /** Emitted just before tests start running  */
  runStart: void;

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

/** A list of event names that don't have associated data */
export type NoDataEvents = 'runStart' | 'runEnd' | 'beforeRun' | 'afterRun';

/**
 * Known plugin types
 */
export interface Plugins {
  reporter: ReporterInitializer;
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

export interface PluginInitializer<T extends any = any> {
  (options?: { [key: string]: any }): CancellablePromise<T> | T;
}

export interface ReporterInitializer {
  (options?: any): Reporter;
}

/**
 * A 'reporter' as far as Executor is concerned. There is currently no
 * pre-defined functionality required for reporters.
 */
export interface Reporter {}
