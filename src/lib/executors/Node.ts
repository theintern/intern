import { existsSync, readFileSync } from 'fs';
import { dirname, normalize, resolve, sep } from 'path';
import { sync as nodeResolve } from 'resolve';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
import { createInstrumenter, Instrumenter } from 'istanbul-lib-instrument';
import { createSourceMapStore, MapStore } from 'istanbul-lib-source-maps';
import {
  hookRunInThisContext,
  hookRequire,
  unhookRunInThisContext
} from 'istanbul-lib-hook';
import { global, Task, CancellablePromise, deepMixin } from '@theintern/common';
import Command from '@theintern/leadfoot/Command';
import LeadfootServer from '@theintern/leadfoot/Server';
import Tunnel, { DownloadProgressEvent } from '@theintern/digdug/Tunnel';

// Dig Dug tunnels
import SeleniumTunnel from '@theintern/digdug/SeleniumTunnel';
import BrowserStackTunnel, {
  BrowserStackOptions
} from '@theintern/digdug/BrowserStackTunnel';
import SauceLabsTunnel from '@theintern/digdug/SauceLabsTunnel';
import TestingBotTunnel from '@theintern/digdug/TestingBotTunnel';
import CrossBrowserTestingTunnel from '@theintern/digdug/CrossBrowserTestingTunnel';
import NullTunnel from '@theintern/digdug/NullTunnel';

import { Config, EnvironmentSpec } from '../common/config';
import Executor, { Events, Plugins } from './Executor';
import { normalizePathEnding } from '../common/path';
import { pullFromArray } from '../common/util';
import { expandFiles, readSourceMap } from '../node/util';
import ErrorFormatter from '../node/ErrorFormatter';
import ProxiedSession from '../ProxiedSession';
import Environment from '../Environment';
import resolveEnvironments from '../resolveEnvironments';
import Server from '../Server';
import Suite, { isSuite } from '../Suite';
import RemoteSuite from '../RemoteSuite';
import { RuntimeEnvironment } from '../types';
import * as console from '../common/console';

// Reporters
import Pretty from '../reporters/Pretty';
import Runner from '../reporters/Runner';
import Simple from '../reporters/Simple';
import JUnit from '../reporters/JUnit';
import Cobertura from '../reporters/Cobertura';
import JsonCoverage from '../reporters/JsonCoverage';
import HtmlCoverage from '../reporters/HtmlCoverage';
import Lcov from '../reporters/Lcov';
import Benchmark from '../reporters/Benchmark';
import TeamCity from '../reporters/TeamCity';

const process: NodeJS.Process = global.process;

export default class Node extends Executor<NodeEvents, Config, NodePlugins> {
  server: Server | undefined;
  tunnel: Tunnel | undefined;

  protected _coverageMap: CoverageMap;
  protected _coverageFiles: string[] | undefined;
  protected _loadingFunctionalSuites: boolean | undefined;
  protected _instrumentBasePath: string | undefined;
  protected _instrumenter: Instrumenter | undefined;
  protected _sourceMaps: MapStore;
  protected _instrumentedMaps: MapStore;
  protected _unhookRequire: (() => void) | undefined;
  protected _sessionSuites: Suite[] | undefined;

  constructor(options?: { [key in keyof Config]?: any }) {
    super({
      basePath: process.cwd() + sep,
      capabilities: {},
      coverage: [],
      environments: [],
      functionalCoverage: true,
      functionalSuites: [],
      functionalTimeouts: {},
      instrumenterOptions: {},
      maxConcurrency: Infinity,
      name: 'node',
      reporters: [],
      runInSync: false,
      serveOnly: false,
      serverPort: 9000,
      serverUrl: '',
      socketPort: 9001,
      tunnel: 'selenium',
      tunnelOptions: { tunnelId: String(Date.now()) }
    });

    this._sourceMaps = createSourceMapStore();
    this._instrumentedMaps = createSourceMapStore();
    this._errorFormatter = new ErrorFormatter(this);
    this._coverageMap = createCoverageMap();

    this.registerReporter('pretty', options => new Pretty(this, options));
    this.registerReporter('simple', options => new Simple(this, options));
    this.registerReporter('runner', options => new Runner(this, options));
    this.registerReporter('benchmark', options => new Benchmark(this, options));
    this.registerReporter('junit', options => new JUnit(this, options));
    this.registerReporter(
      'jsoncoverage',
      options => new JsonCoverage(this, options)
    );
    this.registerReporter(
      'htmlcoverage',
      options => new HtmlCoverage(this, options)
    );
    this.registerReporter('lcov', options => new Lcov(this, options));
    this.registerReporter('cobertura', options => new Cobertura(this, options));
    this.registerReporter('teamcity', options => new TeamCity(this, options));

    this.registerTunnel('null', NullTunnel);
    this.registerTunnel('selenium', SeleniumTunnel);
    this.registerTunnel('saucelabs', SauceLabsTunnel);
    this.registerTunnel('browserstack', BrowserStackTunnel);
    this.registerTunnel('testingbot', TestingBotTunnel);
    this.registerTunnel('cbt', CrossBrowserTestingTunnel);

    if (options) {
      this.configure(options);
    }

    // Report uncaught errors
    process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
      console.warn('Unhandled rejection:', reason, promise);
      const { warnOnUnhandledRejection } = this.config;
      if (
        warnOnUnhandledRejection &&
        (warnOnUnhandledRejection === true ||
          warnOnUnhandledRejection.test(`${reason}`))
      ) {
        this.emit('warning', `${reason}`);
      } else {
        this.emit('error', reason);
      }
    });

    process.on('uncaughtException', (reason: Error) => {
      console.warn('Unhandled error:', reason);
      if (
        this.config.warnOnUncaughtException &&
        (this.config.warnOnUncaughtException === true ||
          this.config.warnOnUncaughtException.test(`${reason}`))
      ) {
        this.emit('warning', `${reason}`);
      } else {
        this.emit('error', reason);
      }
    });

    this.on('coverage', message => {
      this._coverageMap.merge(message.coverage);
    });
  }

  get coverageMap() {
    return this._coverageMap;
  }

  get environment(): RuntimeEnvironment {
    return 'node';
  }

  get instrumentedMapStore() {
    return this._instrumentedMaps;
  }

  get sourceMapStore() {
    return this._sourceMaps;
  }

  get hasCoveredFiles() {
    return this._coverageFiles && this._coverageFiles.length > 0;
  }

  /**
   * The root suites managed by this executor
   */
  get suites() {
    const suites = [];

    // Only include the rootSuite if some suites were added to it.
    if (this._rootSuite.tests.length > 0) {
      suites.push(this._rootSuite);
    }

    if (this._sessionSuites) {
      suites.push(...this._sessionSuites);
    }

    return suites;
  }

  /**
   * Override Executor#addSuite to handle functional suites
   */
  addSuite(factory: (parentSuite: Suite) => void) {
    if (this._loadingFunctionalSuites) {
      this._sessionSuites!.forEach(factory);
    } else {
      super.addSuite(factory);
    }
  }

  /**
   * Retrieve a registered tunnel constructor
   */
  getTunnel(name: string): typeof Tunnel {
    return this.getPlugin<typeof Tunnel>(`tunnel.${name}`);
  }

  /**
   * Insert coverage instrumentation into a given code string
   */
  instrumentCode(code: string, filename: string): string {
    this.log('Instrumenting', filename);
    const sourceMap = readSourceMap(filename, code);
    if (sourceMap) {
      this._sourceMaps.registerMap(filename, sourceMap);
    }

    try {
      const instrumenter = this._instrumenter!;
      const newCode = instrumenter.instrumentSync(
        code,
        normalize(filename),
        sourceMap
      );

      this._coverageMap.addFileCoverage(instrumenter.lastFileCoverage());
      this._instrumentedMaps.registerMap(
        filename,
        instrumenter.lastSourceMap()
      );

      return newCode;
    } catch (error) {
      this.emit('warning', `Error instrumenting ${filename}: ${error.message}`);
      return code;
    }
  }

  /**
   * Load scripts using Node's require
   */
  loadScript(script: string | string[]): CancellablePromise<void> {
    const scripts = Array.isArray(script) ? script : [script];

    try {
      for (const script of scripts) {
        const file = resolve(script);
        if (existsSync(file)) {
          require(file);
        } else {
          // `script` isn't a valid file path, so maybe it's a
          // Node-resolvable module
          require(nodeResolve(script, { basedir: process.cwd() }));
        }
      }
    } catch (error) {
      return Task.reject<void>(error);
    }

    return Task.resolve();
  }

  /**
   * Register a tunnel constructor with the plugin system. It can be retrieved
   * later with getTunnel or getPlugin.
   */
  registerTunnel(name: string, Ctor: typeof Tunnel) {
    this.registerPlugin('tunnel', name, () => Ctor);
  }

  /**
   * Return true if a given file should be instrumented based on the current
   * config
   */
  shouldInstrumentFile(filename: string) {
    return this._coverageFiles
      ? this._coverageFiles.indexOf(filename) !== -1
      : false;
  }

  protected _afterRun() {
    return super._afterRun().finally(() => {
      this._removeInstrumentationHooks();

      const promises: Promise<any>[] = [];
      if (this.server) {
        promises.push(
          this.server
            .stop()
            .then(() => this.emit('serverEnd', <any>this.server))
        );
      }
      if (this.tunnel) {
        const tunnel = this.tunnel;
        promises.push(
          tunnel.stop().then(() => this.emit('tunnelStop', { tunnel }))
        );
      }
      // We do not want to actually return an array of values, so chain a
      // callback that resolves to undefined
      return Promise.all(promises).then(
        () => {},
        error => this.emit('error', error)
      );
    });
  }

  protected _beforeRun() {
    return super._beforeRun().then(() => {
      const config = this.config;

      const suite = this._rootSuite;
      suite.grep = config.grep;
      suite.timeout = config.defaultTimeout;
      suite.bail = config.bail;

      if (
        // Only start the server if there are remote environments *and*
        // either functionalSuites or browser suites
        (config.environments.filter(isRemoteEnvironment).length > 0 &&
          config.functionalSuites.length + config.browser.suites.length > 0) ||
        // User can start the server without planning to run functional
        // tests
        config.serveOnly
      ) {
        const serverTask: CancellablePromise<void> = new Task<void>(
          (resolve, reject) => {
            const server: Server = new Server({
              basePath: config.basePath,
              executor: this,
              port: config.serverPort,
              runInSync: config.runInSync,
              socketPort: config.socketPort
            });

            server
              .start()
              .then(() => {
                this.server = server;
                return this.emit('serverStart', server);
              })
              .then(resolve, reject);
          }
        );

        // If we're in serveOnly mode, just start the server server.
        // Don't create session suites or start a tunnel.
        if (config.serveOnly) {
          return serverTask.then(() => {
            // In serveOnly mode we just start the server to static
            // file serving and instrumentation. Return an
            // unresolved Task to pause indefinitely until canceled.
            return new Task<boolean>(resolve => {
              process.on('SIGINT', () => {
                resolve(true);
              });
            });
          });
        }

        return serverTask
          .then(() => {
            const tunnelOptions = config.tunnelOptions;
            if (config.tunnel === 'browserstack') {
              const options = <BrowserStackOptions>tunnelOptions;
              options.servers = options.servers || [];
              options.servers.push(config.serverUrl);
            }

            if ('proxy' in config && !('proxy' in tunnelOptions)) {
              tunnelOptions.proxy = config.proxy;
            }

            let TunnelConstructor = this.getTunnel(config.tunnel);
            const tunnel = (this.tunnel = new TunnelConstructor(
              this.config.tunnelOptions
            ));

            tunnel.on('downloadprogress', progress => {
              this.emit('tunnelDownloadProgress', {
                tunnel,
                progress
              });
            });

            tunnel.on('status', status => {
              this.emit('tunnelStatus', {
                tunnel,
                status: status.status
              });
            });

            config.capabilities = deepMixin(
              tunnel.extraCapabilities,
              config.capabilities
            );

            return this._createSessionSuites().then(() => {
              return tunnel
                .start()
                .then(() => this.emit('tunnelStart', { tunnel }));
            });
          })
          .then(() => {
            return false;
          });
      }

      return false;
    });
  }

  /**
   * Creates suites for each environment in which tests will be executed. This
   * method will only be called if there are both environments and suites to
   * run.
   */
  protected _createSessionSuites() {
    const tunnel = this.tunnel!;
    const config = this.config;

    const leadfootServer = new LeadfootServer(tunnel.clientUrl, {
      proxy: 'proxy' in config ? config.proxy : tunnel.proxy
    });

    const executor = this;

    // Create a subclass of ProxiedSession here that will ensure the
    // executor is set
    class InitializedProxiedSession extends ProxiedSession {
      executor = executor;
      coverageVariable = config.coverageVariable;
      baseUrl = config.functionalBaseUrl || config.serverUrl;
    }

    leadfootServer.sessionConstructor = InitializedProxiedSession;

    return tunnel.getEnvironments().then(tunnelEnvironments => {
      this._sessionSuites = resolveEnvironments(
        config.capabilities,
        config.environments.filter(isRemoteEnvironment),
        tunnelEnvironments
      ).map(environmentType => {
        let session: ProxiedSession;

        // Create a new root suite for each environment
        const suite = new Suite({
          name: String(environmentType),
          publishAfterSetup: true,
          grep: config.grep,
          bail: config.bail,
          tests: [],
          timeout: config.defaultTimeout,
          executor: this,

          before() {
            executor.log('Creating session for', environmentType);
            return leadfootServer
              .createSession<ProxiedSession>(environmentType)
              .then(_session => {
                session = _session;
                this.executor.log('Created session:', session.capabilities);

                let remote: Remote = <Remote>new Command(session);
                remote.environmentType = new Environment(session.capabilities);
                remote.requestedEnvironment = environmentType;
                this.remote = remote;
                this.sessionId = remote.session.sessionId;

                // Update the name with details from the remote
                // environment
                this.name = remote.environmentType.toString();

                const timeouts = config.functionalTimeouts;
                let promise = Promise.resolve();
                if (timeouts.executeAsync != null) {
                  promise = promise.then(() =>
                    remote.setExecuteAsyncTimeout(timeouts.executeAsync!)
                  );
                  this.executor.log(
                    'Set remote executeAsync timeout to ',
                    timeouts.executeAsync
                  );
                }
                if (timeouts.find != null) {
                  promise = promise.then(() =>
                    remote.setFindTimeout(timeouts.find!)
                  );
                  this.executor.log(
                    'Set remote find timeout to ',
                    timeouts.find
                  );
                }
                if (timeouts.pageLoad != null) {
                  promise = promise.then(() =>
                    remote.setPageLoadTimeout(timeouts.pageLoad!)
                  );
                  this.executor.log(
                    'Set remote pageLoad timeout to ',
                    timeouts.pageLoad
                  );
                }

                return promise;
              });
          },

          after() {
            const remote = this.remote;

            if (remote) {
              const endSession = () => {
                // Check for an error in this suite or a
                // sub-suite. This check is a bit more involved
                // than just checking for a local suite error or
                // failed tests since sub-suites may have
                // failures that don't result in failed tests.
                function hasError(suite: Suite): boolean {
                  if (suite.error != null || suite.numFailedTests > 0) {
                    return true;
                  }
                  return suite.tests.filter(isSuite).some(hasError);
                }
                return tunnel.sendJobState(remote.session.sessionId, {
                  success: !hasError(this)
                });
              };

              if (
                config.leaveRemoteOpen === true ||
                (config.leaveRemoteOpen === 'fail' && this.numFailedTests > 0)
              ) {
                return endSession();
              }

              return remote.quit().finally(endSession);
            }
          }
        });

        // If browser-compatible unit tests were added to this executor,
        // add a RemoteSuite to the session suite. The RemoteSuite will
        // run the suites listed in config.browser.suites.
        if (config.browser.suites.length > 0) {
          suite.add(new RemoteSuite());
        }

        return suite;
      });
    });
  }

  /**
   * Load functional test suites
   */
  protected _loadFunctionalSuites(): CancellablePromise<void> {
    this._loadingFunctionalSuites = true;
    const suites = this.config.functionalSuites;

    // Set the instrumentation hooks if necessary
    if (
      this.config.functionalCoverage !== false &&
      !this._unhookRequire &&
      this.hasCoveredFiles
    ) {
      this._setInstrumentationHooks();
    }

    return Task.resolve(this._loader(suites))
      .then(() => {
        this.log('Loaded functional suites:', suites);
      })
      .finally(() => {
        this._loadingFunctionalSuites = false;
      });
  }

  /**
   * Override Executor#_loadSuites to set instrumentetion hooks before loading
   * suites
   */
  protected _loadSuites(): CancellablePromise<void> {
    // Don't load suites if there isn't a local environment, or if we're
    // in serveOnly mode
    if (
      !this.config.environments.some(isLocalEnvironment) ||
      this.config.serveOnly
    ) {
      return Task.resolve();
    }

    if (this.hasCoveredFiles) {
      this._setInstrumentationHooks();
    }

    return super._loadSuites();
  }

  protected _resolveConfig() {
    return super._resolveConfig().then(() => {
      const config = this.config;

      if (config.environments.length === 0) {
        this.log("Adding default 'node' environment");
        config.environments.push({ browserName: 'node' });
      }

      if (!config.internPath) {
        config.internPath = dirname(dirname(__dirname));

        // If internPath isn't under cwd, intern is most likely
        // symlinked into the project's node_modules. In that case, use
        // the package location as resolved from the project root.
        if (config.internPath.indexOf(process.cwd()) !== 0) {
          // nodeResolve will resolve to index.js; we want the base
          // intern directory
          config.internPath = dirname(
            nodeResolve('intern', {
              basedir: process.cwd()
            })
          );
        }
      }

      ['basePath', 'internPath'].forEach(property => {
        const key = <keyof Config>property;
        config[key] = normalizePathEnding(resolve(<string>config[key]), sep);
      });

      if (config.benchmarkConfig) {
        config.reporters.push({
          name: 'benchmark',
          options: config.benchmarkConfig
        });
      }

      this._instrumentBasePath = config.basePath;
      this._coverageFiles = [];

      if (config.coverage) {
        // Coverage file entries should be absolute paths
        this._coverageFiles = expandFiles(config.coverage).map(path =>
          resolve(path)
        );
      }

      if (!config.serverUrl) {
        config.serverUrl = `http://localhost:${config.serverPort}/`;
      }

      if (config.connectTimeout == null) {
        config.connectTimeout = 30000;
      }

      if (config.heartbeatInterval == null) {
        const idleTimeout = config.capabilities['idle-timeout'];
        config.heartbeatInterval = idleTimeout == null ? 60 : idleTimeout;
      }

      // Ensure URLs end with a '/'
      ['serverUrl', 'functionalBaseUrl'].forEach(key => {
        const property = <keyof Config>key;
        if (config[property]) {
          config[property] = (<string>config[property]).replace(/\/*$/, '/');
        }
      });

      // Set a default name for a WebDriver session
      if (!config.capabilities.name) {
        config.capabilities.name = 'intern';
      }

      // idle-timeout isn't universally supported, but keep setting it by
      // default
      if (config.capabilities['idle-timeout'] == null) {
        config.capabilities['idle-timeout'] = config.heartbeatInterval;
      }

      const buildId = process.env.TRAVIS_COMMIT || process.env.BUILD_TAG;
      if (buildId) {
        config.capabilities.build = buildId;
      }

      // Expand suite globs
      config.functionalSuites = expandFiles(config.functionalSuites);

      // Expand suite globs into the node and browser objects
      config.node.suites = expandFiles([
        ...config.suites,
        ...config.node.suites
      ]);
      config.browser.suites = expandFiles([
        ...config.suites,
        ...config.browser.suites
      ]);

      // Clear out the suites list after combining the suites
      delete config.suites;

      // Install the instrumenter in resolve config so it will be able to
      // handle suites
      this._instrumenter = createInstrumenter(
        Object.assign(
          {},
          {
            coverageVariable: config.coverageVariable,
            ...config.instrumenterOptions
          },
          {
            preserveComments: true,
            produceSourceMap: true
          }
        )
      );
    });
  }

  protected _runTests(): CancellablePromise<void> {
    let testTask: CancellablePromise<void>;

    return new Task<void>(
      (resolve, reject) => {
        if (this._rootSuite.tests.length > 0) {
          testTask = this._rootSuite.run();
        } else {
          testTask = Task.resolve();
        }

        testTask
          .then(() => {
            if (!this._sessionSuites) {
              return;
            }
            return this._loadFunctionalSuites().then(
              () => (testTask = this._runRemoteTests())
            );
          })
          .then(resolve, reject);
      },
      () => {
        if (testTask) {
          testTask.cancel();
        }
      }
    ).finally(() => {
      // For all files that are marked for coverage that weren't read,
      // read the file and instrument the code (adding it to the overall
      // coverage map)
      const coveredFiles = this._coverageMap.files();
      const uncoveredFiles = this._coverageFiles!.filter(filename => {
        return coveredFiles.indexOf(filename) === -1;
      });
      uncoveredFiles.forEach(filename => {
        try {
          const code = readFileSync(filename, { encoding: 'utf8' });
          this.instrumentCode(code, filename);
        } catch (_error) {}
      });
    });
  }

  protected _runRemoteTests(): CancellablePromise<void> {
    const config = this.config;
    const sessionSuites = this._sessionSuites!;
    const queue = new FunctionQueue(config.maxConcurrency || Infinity);

    this.log(
      'Running',
      sessionSuites.length,
      'suites with maxConcurrency',
      config.maxConcurrency
    );

    const runTask = new Task(
      (resolve, reject) => {
        Task.all(
          sessionSuites.map(suite => {
            this.log('Queueing suite', suite.name);
            return queue.enqueue(() => {
              this.log('Running suite', suite.name);
              return suite.run();
            });
          })
        ).then(resolve, reject);
      },
      () => {
        this.log('Canceling remote tests');
        queue.clear();
      }
    );

    return runTask.then(() => {}).finally(() => {
      if (config.functionalCoverage !== false) {
        // Collect any local coverage generated by functional tests
        this.log('Emitting functional coverage');
        return this._emitCoverage('functional tests');
      }
    });
  }

  /**
   * Adds hooks for code coverage instrumentation in the Node.js loader.
   */
  protected _setInstrumentationHooks() {
    hookRunInThisContext(
      filename => this.shouldInstrumentFile(filename),
      (code, filename) => this.instrumentCode(code, filename)
    );
    this._unhookRequire = hookRequire(
      filename => this.shouldInstrumentFile(filename),
      (code, filename) => this.instrumentCode(code, filename)
    );
  }

  /**
   * Removes instrumentation hooks
   */
  protected _removeInstrumentationHooks() {
    unhookRunInThisContext();
    if (this._unhookRequire) {
      this._unhookRequire();
      this._unhookRequire = undefined;
    }
  }
}

export { Config, EnvironmentSpec };

export interface NodePlugins extends Plugins {
  tunnel: typeof Tunnel;
}

export interface Remote extends Command<any> {
  environmentType?: Environment;
  requestedEnvironment?: Environment;
  setHeartbeatInterval(delay: number): Command<any>;
}

export interface TunnelMessage {
  tunnel: Tunnel;
  progress?: DownloadProgressEvent;
  status?: string;
}

export interface NodeEvents extends Events {
  /** A test server has stopped */
  serverEnd: Server;

  /** A test server was started */
  serverStart: Server;

  /** Emitted as a Tunnel executable download is in process */
  tunnelDownloadProgress: TunnelMessage;

  /** A WebDriver tunnel has been opened */
  tunnelStart: TunnelMessage;

  /** A status update from a WebDriver tunnel */
  tunnelStatus: TunnelMessage;

  /** A WebDriver tunnel has been stopped */
  tunnelStop: TunnelMessage;
}

/**
 * A basic FIFO function queue to limit the number of currently executing
 * asynchronous functions.
 */
class FunctionQueue {
  readonly maxConcurrency: number;
  queue: QueueEntry[];
  activeTasks: CancellablePromise<any>[];
  funcTasks: CancellablePromise<any>[];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
    this.queue = [];
    this.activeTasks = [];
    this.funcTasks = [];
  }

  enqueue(func: () => CancellablePromise<any>) {
    const funcTask = new Task((resolve, reject) => {
      this.queue.push({ func, resolve, reject });
    });
    this.funcTasks.push(funcTask);

    if (this.activeTasks.length < this.maxConcurrency) {
      this.next();
    }

    return funcTask;
  }

  clear() {
    this.activeTasks.forEach(task => task.cancel());
    this.funcTasks.forEach(task => task.cancel());
    this.activeTasks = [];
    this.funcTasks = [];
    this.queue = [];
  }

  next() {
    if (this.queue.length > 0) {
      const { func, resolve, reject } = this.queue.shift()!;
      const task = func()
        .then(resolve, reject)
        .finally(() => {
          // Remove the task from the active task list and kick off
          // the next task
          pullFromArray(this.activeTasks, task);
          this.next();
        });
      this.activeTasks.push(task);
    }
  }
}

interface QueueEntry {
  func: () => CancellablePromise<any>;
  resolve: () => void;
  reject: () => void;
}

function isRemoteEnvironment(environment: EnvironmentSpec) {
  return environment.browserName !== 'node';
}

function isLocalEnvironment(environment: EnvironmentSpec) {
  return !isRemoteEnvironment(environment);
}
