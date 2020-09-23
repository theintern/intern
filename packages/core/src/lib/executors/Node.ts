import { existsSync, readFileSync } from 'fs';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
import {
  hookRequire,
  hookRunInThisContext,
  unhookRunInThisContext
} from 'istanbul-lib-hook';
import { createInstrumenter, Instrumenter } from 'istanbul-lib-instrument';
import { createSourceMapStore, MapStore } from 'istanbul-lib-source-maps';
import { join, normalize, resolve } from 'path';
import { sync as nodeResolve } from 'resolve';
import { register } from 'ts-node';
import { deepMixin, global } from '@theintern/common';
// Dig Dug tunnels
import BrowserStackTunnel, {
  BrowserStackProperties
} from '@theintern/digdug/dist/BrowserStackTunnel';
import CrossBrowserTestingTunnel from '@theintern/digdug/dist/CrossBrowserTestingTunnel';
import NullTunnel from '@theintern/digdug/dist/NullTunnel';
import SauceLabsTunnel from '@theintern/digdug/dist/SauceLabsTunnel';
import SeleniumTunnel, {
  getDriverNames
} from '@theintern/digdug/dist/SeleniumTunnel';
import TestingBotTunnel from '@theintern/digdug/dist/TestingBotTunnel';
import Tunnel, { DownloadProgressEvent } from '@theintern/digdug/dist/Tunnel';
import { WebDriver, isWebDriver } from '@theintern/digdug/dist/types';
import Command from '@theintern/leadfoot/dist/Command';
import LeadfootServer from '@theintern/leadfoot/dist/Server';
import * as console from '../common/console';
import { pullFromArray } from '../common/util';
import { Config, EnvironmentSpec } from '../config';
import Environment from '../Environment';
import {
  ErrorFormatter,
  createConfigurator,
  expandFiles,
  getDefaultBasePath,
  getDefaultInternPath,
  isTypeScriptFile,
  readSourceMap,
  transpileSource
} from '../node';
import ProxiedSession from '../ProxiedSession';
import RemoteSuite from '../RemoteSuite';
// Reporters
import Benchmark from '../reporters/Benchmark';
import Cobertura from '../reporters/Cobertura';
import HtmlCoverage from '../reporters/HtmlCoverage';
import JsonCoverage from '../reporters/JsonCoverage';
import JUnit from '../reporters/JUnit';
import Lcov from '../reporters/Lcov';
import Pretty from '../reporters/Pretty';
import Runner from '../reporters/Runner';
import Simple from '../reporters/Simple';
import TeamCity from '../reporters/TeamCity';
import resolveEnvironments from '../resolveEnvironments';
import Server from '../Server';
import Suite, { isFailedSuite, isSuite } from '../Suite';
import { RuntimeEnvironment } from '../types';
import Executor, { Events, ExecutorConfig, Plugins } from './Executor';

const process: NodeJS.Process = global.process;

export default class Node extends Executor<NodeEvents, NodePlugins> {
  server: Server | undefined;
  tunnel: Tunnel | undefined;

  protected _coverageMap: CoverageMap;
  protected _coverageFiles: { [filename: string]: boolean };
  protected _loadingFunctionalSuites: boolean | undefined;
  protected _instrumenter: Instrumenter | undefined;
  protected _sourceMaps: MapStore;
  protected _instrumentedMaps: MapStore;
  protected _unhookRequire: (() => void) | undefined;
  protected _sessionSuites: Suite[] | undefined;

  constructor(config?: ExecutorConfig) {
    super(createConfigurator, {
      basePath: getDefaultBasePath(),
      capabilities: {
        buildId: process.env.TRAVIS_COMMIT || process.env.BUILD_TAG,
        name: 'intern'
      },
      connectTimeout: 30000,
      internPath: getDefaultInternPath(),
      name: 'node'
    });

    // Add in any additional config options
    if (config) {
      this.configure(config);
    }

    this._sourceMaps = createSourceMapStore();
    this._instrumentedMaps = createSourceMapStore();
    this._errorFormatter = new ErrorFormatter(this);
    this._coverageMap = createCoverageMap();
    this._coverageFiles = {};

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

    // Report uncaught errors
    process.on(
      'unhandledRejection',
      (reason: {} | null | undefined, promise: Promise<any>) => {
        console.warn('Unhandled rejection:', promise);
        const { warnOnUnhandledRejection } = this.config;
        if (
          warnOnUnhandledRejection &&
          (warnOnUnhandledRejection === true ||
            warnOnUnhandledRejection.test(`${reason}`))
        ) {
          this.emit('warning', `${reason}`);
        } else {
          this.emit('error', reason as Error);
        }
      }
    );

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
    return Object.entries(this._coverageFiles).length > 0;
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
  instrumentCode(
    code: string,
    filename: string,
    shouldCompile?: boolean
  ): string {
    if (filename.endsWith('.d.ts')) {
      this.log('Skipping instrumentation of', filename);
      return code;
    }

    if (shouldCompile) {
      this.log('Transpiling rather than instrumenting', filename);
      return transpileSource(filename, code);
    }

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
    }

    return code;
  }

  /**
   * Load scripts using Node's require
   */
  loadScript(script: string | string[]): Promise<void> {
    const scripts = Array.isArray(script) ? script : [script];

    try {
      for (let script of scripts) {
        if (/\.\?$/.test(script)) {
          if (/\.ts$/i.test(__filename)) {
            script = script.replace(/\?$/, 'ts');
          } else {
            script = script.replace(/\?$/, 'js');
          }
        }
        const file = resolve(this.config.basePath, script);
        if (existsSync(file)) {
          require(file);
        } else {
          // `script` isn't a valid file path, so maybe it's a
          // Node-resolvable module
          require(nodeResolve(script, { basedir: this.config.basePath }));
        }
      }
    } catch (error) {
      return Promise.reject<void>(error);
    }

    return Promise.resolve();
  }

  /**
   * Register a tunnel constructor with the plugin system. It can be retrieved
   * later with getTunnel or getPlugin.
   */
  registerTunnel(name: string, Ctor: typeof Tunnel) {
    this.registerPlugin('tunnel', name, () => Ctor);
  }

  /**
   * Process any inter-property dependencies for the config
   */
  async resolveConfig() {
    await super.resolveConfig();

    this.log('resolving Node config');

    // The cancel token will exist if `resolveConfig` is called
    // outside of `run`
    this._cancelToken?.throwIfCancelled();

    const config = this.config;

    // If benchmarking is configured, make sure the benchmark reporter is added
    if (config.benchmark && config.benchmarkConfig) {
      config.reporters.push({
        name: 'benchmark',
        options: config.benchmarkConfig
      });
    }

    // Expand coverage globs
    if (config.coverage) {
      for (const path of expandFiles(config.coverage)) {
        this._coverageFiles[resolve(path)] = false;
      }
    }

    // If serverUrl isn't already set, create a default value based on the
    // serverPort
    if (!config.serverUrl) {
      config.serverUrl = `http://localhost:${config.serverPort}/`;
    }

    if (typeof config.capabilities['idle-timeout'] === 'undefined') {
      config.capabilities['idle-timeout'] = config.heartbeatInterval;
    }

    // Expand suite globs
    config.functionalSuites = expandFiles(config.functionalSuites);
    config.suites = expandFiles(config.suites);
    if (config.node?.suites) {
      config.node.suites = expandFiles(config.node.suites);
    }
    if (config.browser?.suites) {
      config.browser.suites = expandFiles(config.browser.suites);
    }

    // If we're using the Selenium tunnel, make sure the necessary drivers are
    // specified
    if (config.tunnel === 'selenium') {
      this.log('Fixing up tunnel drivers...');
      const { tunnelOptions } = config;
      const configuredDrivers =
        tunnelOptions?.drivers
          ?.filter<WebDriver>(isWebDriver)
          .map(driver => driver.browserName) ?? [];
      const driverNames = getDriverNames(config.environments).filter(
        name => configuredDrivers.indexOf(name) === -1
      );

      this.log(`raw drivers: ${JSON.stringify(tunnelOptions.drivers)}`);
      this.log(`Configured drivers: ${JSON.stringify(configuredDrivers)}`);
      this.log(`Environments: ${JSON.stringify(config.environments)}`);
      this.log(`Driver names: ${JSON.stringify(driverNames)}`);

      // Mix the required driverNames into the drivers already in the config
      tunnelOptions.drivers = [
        ...(tunnelOptions.drivers ?? []),
        ...driverNames.map(browserName => ({ browserName }))
      ];

      this.log(`Drivers: ${JSON.stringify(tunnelOptions.drivers)}`);
    } else if (config.tunnel === 'browserstack') {
      // When using BrowserStack, the serverUrl should be included in the
      // tunnelOptions
      const tunnelOptions = (config.tunnelOptions ||
        {}) as BrowserStackProperties;
      if (!tunnelOptions.servers) {
        tunnelOptions.servers = [];
      }
      if (tunnelOptions.servers.indexOf(config.serverUrl) === -1) {
        tunnelOptions.servers.push(config.serverUrl);
      }
      config.tunnelOptions = tunnelOptions;
    }

    // If a proxy is defined in the config, it should be passed to the tunnel
    if (
      'proxy' in config &&
      config.tunnelOptions &&
      !('proxy' in config.tunnelOptions)
    ) {
      config.tunnelOptions.proxy = config.proxy;
    }

    // If there are remote environments, resolve them using environments
    // available through the tunnel specified in the config.
    const remoteEnvironments = config.environments.filter(isRemoteEnvironment);
    if (remoteEnvironments.length > 0 && config.tunnel) {
      const tunnel = this._createTunnel();

      // Add any extra capabilites provided by the tunnel to the config's
      // capabilities
      deepMixin(config.capabilities, tunnel.extraCapabilities);

      const tunnelEnvironments = await tunnel.getEnvironments();

      // Resolve the environments, matching versions, platforms, and browser
      // names from the config with whats available from the tunnel
      // enviroment.
      const resolvedEnvironments = resolveEnvironments(
        config.capabilities,
        remoteEnvironments,
        tunnelEnvironments
      );

      const localEnvironments = config.environments.filter(
        env => !isRemoteEnvironment(env)
      );

      // The full environments list is all the local environments (generally
      // just node) with all the remote environments.
      config.environments = [...localEnvironments, ...resolvedEnvironments];
    }
  }

  /**
   * Return true if a given file should be instrumented based on the current
   * config
   */
  shouldInstrumentFile(filename: string) {
    if (!(filename in this._coverageFiles)) {
      return false;
    }
    // Entries in this._coverageFiles are true if a file has already been
    // instrumented
    return !this._coverageFiles[filename];
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
        () => {
          /* do nothing */
        },
        error => this.emit('error', error)
      );
    });
  }

  protected _beforeRun() {
    return super._beforeRun().then(() => {
      const config = this.config;

      this.log('Node _beforeRun');
      this._rootSuite.timeout = config.defaultTimeout;

      this.log('environments:', config.environments);

      if (
        // Only start the server if there are remote environments *and*
        // suites that would run in (or would drive) a browser
        (config.environments.filter(isRemoteEnvironment).length > 0 &&
          config.functionalSuites.length +
            config.suites.length +
            (config.browser?.suites?.length ?? 0) >
            0) ||
        // User can start the server without planning to run functional
        // tests
        config.serveOnly
      ) {
        this.log('Starting server');

        const serverPromise = new Promise<void>((resolve, reject) => {
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
              this.log('Started test server');
              return this.emit('serverStart', server);
            })
            .then(resolve, reject);
        });

        // If we're in serveOnly mode, just start the server server.
        // Don't create session suites or start a tunnel.
        if (config.serveOnly) {
          this.log('Running in serveOnly mode');
          return serverPromise.then(() => {
            // In serveOnly mode we just start the server to static
            // file serving and instrumentation. Return an
            // unresolved Promise to pause indefinitely until cancelled.
            return new Promise<boolean>(resolve => {
              process.on('SIGINT', () => {
                resolve(true);
              });
            });
          });
        }

        return serverPromise
          .then(() => {
            // Tunnel will have been created in resolveConfig
            const tunnel = this.tunnel!;

            this._createSessionSuites();

            // TODO: save the listener handles so they can be destroyed when the
            // test run is over

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

            return tunnel.start().then(() => {
              this.log('Started tunnel');
              this.emit('tunnelStart', { tunnel });
            });
          })
          .then(() => {
            return false;
          });
      }

      return false;
    });
  }

  protected _createTunnel() {
    const config = this.config;

    const TunnelConstructor = this.getTunnel(config.tunnel);
    const tunnel = new TunnelConstructor(this.config.tunnelOptions);
    this.tunnel = tunnel;

    return tunnel;
  }

  /**
   * Creates suites for each environment in which tests will be executed. This
   * method will only be called if there are both environments and suites to
   * run.
   */
  protected _createSessionSuites(): void {
    if (!this.tunnel) {
      this.log('No tunnel - Not creating session suites');
      return;
    }

    this.log('Creating session suites');

    const tunnel = this.tunnel;
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

    // config.environments was resolved in resolveConfig
    this._sessionSuites = this.config.environments
      .filter(isRemoteEnvironment)
      .map(environmentType => {
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

                const remote: Remote = <Remote>new Command(session);
                remote.environmentType = new Environment(session.capabilities);
                remote.requestedEnvironment = environmentType;
                this.remote = remote;
                this.sessionId = remote.session.sessionId;

                // Update the name with details from the remote
                // environment
                this.name = remote.environmentType.toString();

                const timeouts = config.functionalTimeouts;

                this.executor.log('timeouts:', timeouts);

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
                  promise = promise.then(() => {
                    this.executor.log(
                      'Actually calling setPageLoadTimeout on',
                      remote
                    );
                    return remote.setPageLoadTimeout(timeouts.pageLoad!);
                  });
                  this.executor.log(
                    'Set remote pageLoad timeout to',
                    timeouts.pageLoad
                  );
                }

                return promise;
              });
          },

          after() {
            const remote = this.remote;

            if (remote != null) {
              const endSession = () => {
                // Check for an error in this suite or a
                // sub-suite. This check is a bit more involved
                // than just checking for a local suite error or
                // failed tests since sub-suites may have
                // failures that don't result in failed tests.
                function hasError(suite: Suite): boolean {
                  if (isFailedSuite(suite)) {
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
        if ((config.browser?.suites?.length ?? 0) > 0) {
          suite.add(new RemoteSuite());
        }

        return suite;
      });
  }

  /**
   * Load functional test suites
   */
  protected _loadFunctionalSuites(): Promise<void> {
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

    return this._cancelToken
      .wrap(Promise.resolve(this._loader(suites)))
      .then(() => {
        this.log('Loaded functional suites:', suites);
      })
      .finally(() => {
        this._loadingFunctionalSuites = false;
      });
  }

  /**
   * Override Executor#_loadSuites to set instrumentation hooks before loading
   * suites
   */
  protected _loadSuites(): Promise<void> {
    // Don't load suites if there isn't a local environment, or if we're
    // in serveOnly mode
    if (
      !this.config.environments.some(isLocalEnvironment) ||
      this.config.serveOnly
    ) {
      return Promise.resolve();
    }

    if (this.hasCoveredFiles) {
      this._setInstrumentationHooks();
    }

    return super._loadSuites();
  }

  /**
   * Setup anything that should be ready before we start loading user code, such
   * as a transpiler
   */
  protected _preLoad(): Promise<void> {
    const config = this.config;

    // Enable the TypeScript loader if necessary
    if (!isTsLoaderIsEnabled()) {
      if (config.node.tsconfig) {
        register({ project: resolve(config.basePath, config.node.tsconfig) });
      } else if (typeof config.node.tsconfig === 'undefined') {
        if (
          config.suites.some(isTypeScriptFile) ||
          config.node.suites?.some(isTypeScriptFile) ||
          config.functionalSuites.some(isTypeScriptFile) ||
          config.plugins.some(({ script }) => isTypeScriptFile(script)) ||
          config.node.plugins?.some(({ script }) => isTypeScriptFile(script))
        ) {
          // Enable TS support if any configured resources need it
          register();
        } else {
          // Enable TS support if a tsconfig file exists in the project root
          const tsconfigPath = join(config.basePath, 'tsconfig.json');
          if (existsSync(tsconfigPath)) {
            register({ project: tsconfigPath });
          }
        }
      }
    }

    // Install the instrumenter
    this._instrumenter = createInstrumenter({
      coverageVariable: config.coverageVariable,
      preserveComments: true,
      produceSourceMap: true,
      ...config.instrumenterOptions
    });

    return Promise.resolve();
  }

  /**
   * Return the names of all the selenium drivers that should be needed based
   * on the environments specified in the config.
   */
  protected _getSeleniumDriverNames(): string[] {
    const { config } = this;
    const driverNames: { [name: string]: boolean } = {};

    for (const env of config.environments) {
      const { browserName } = env;
      if (
        browserName === 'chrome' ||
        browserName === 'firefox' ||
        browserName === 'internet explorer'
      ) {
        driverNames[browserName] = true;
      } else if (browserName === 'MicrosoftEdge') {
        const { browserVersion } = env;
        if (
          (!isNaN(browserVersion) && Number(browserVersion) < 1000) ||
          // 'insider preview' may be used to specify Edge Chromium before it is
          // official released
          (isNaN(browserVersion) && browserVersion === 'insider preview')
        ) {
          driverNames['MicrosoftEdgeChromium'] = true;
        } else {
          driverNames['MicrosoftEdge'] = true;
        }
      }
    }

    return Object.keys(driverNames);
  }

  protected _runTests(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let testPromise: Promise<void>;

      if (this._rootSuite.tests.length > 0) {
        testPromise = this._rootSuite.run();
      } else {
        testPromise = Promise.resolve();
      }

      testPromise
        .then(async () => {
          if (!this._sessionSuites) {
            return;
          }

          const allSessions = this._sessionSuites;
          let sessions = allSessions;
          let remainingAttempts = 1 + (this.config.functionalRetries || 0);
          let suiteError: Error | undefined;

          await this._loadFunctionalSuites();

          while (remainingAttempts && sessions.length) {
            remainingAttempts--;
            suiteError = undefined;

            if (sessions.length !== allSessions.length) {
              this.log(
                'reattempting',
                sessions.length,
                'of',
                allSessions.length,
                'environments'
              );
            }

            try {
              testPromise = this._runRemoteTests(sessions);
              await testPromise;
            } catch (e) {
              this.log(`suite error: ${e}`);
              suiteError = e;
              // recover from exceptions to allow for retries
            }

            const failedSessions = (sessions = sessions.filter(isFailedSuite));

            if (failedSessions.length === allSessions.length) {
              // Do not reattempt if no session has passed
              remainingAttempts = 0;
            } else {
              for (const suite of failedSessions) {
                suite.reset();
              }
            }
          }

          // If a suite error occured in the final retry attempt, the suite
          // definitely failed, so throw the error to indicate that.
          if (suiteError) {
            throw suiteError;
          }
        })
        .then(resolve, reject);
    }).finally(() => {
      // For all files that are marked for coverage that weren't read,
      // read the file and instrument the code (adding it to the overall
      // coverage map)
      const uncoveredFiles: string[] = [];
      if (this._coverageFiles) {
        for (const file in this._coverageFiles) {
          if (!this._coverageFiles[file]) {
            uncoveredFiles.push(file);
          }
        }
      }
      this.log('Adding coverage for uncovered files');
      uncoveredFiles.forEach(filename => {
        try {
          const code = readFileSync(filename, { encoding: 'utf8' });
          this.instrumentCode(code, filename, isTypeScriptFile(filename));
        } catch (error) {
          this.log('Error reading', filename, '-', error);
        }
      });
    });
  }

  protected _runRemoteTests(sessions: Suite[]): Promise<void> {
    const config = this.config;
    const queue = new FunctionQueue(config.maxConcurrency || Infinity);

    if (!this._sessionSuites) {
      return Promise.resolve();
    }

    this.log(
      'Running',
      sessions.length,
      'suites with maxConcurrency',
      config.maxConcurrency
    );

    return Promise.all(
      sessions.map(suite => {
        this.log('Queueing suite', suite.name);
        return queue.enqueue(() => {
          this.log('Running suite', suite.name);
          return suite.run(this._cancelToken);
        });
      })
    )
      .then(() => {
        // Consume any output so void is returned
      })
      .finally(() => {
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
      (code, { filename }) => {
        this._coverageFiles[filename] = true;
        return this.instrumentCode(code, filename);
      }
    );

    this._unhookRequire = hookRequire(
      filename => this.shouldInstrumentFile(filename),
      (code, { filename }) => {
        this._coverageFiles[filename] = true;
        return this.instrumentCode(code, filename);
      },
      { extensions: ['.js', '.jsx', '.ts', '.tsx'] }
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
  activePromises: Promise<any>[];
  funcPromises: Promise<any>[];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
    this.queue = [];
    this.activePromises = [];
    this.funcPromises = [];
  }

  enqueue(func: () => Promise<any>) {
    const funcPromise = new Promise((resolve, reject) => {
      this.queue.push({ func, resolve, reject });
    });
    this.funcPromises.push(funcPromise);

    if (this.activePromises.length < this.maxConcurrency) {
      this.next();
    }

    return funcPromise;
  }

  clear() {
    this.activePromises = [];
    this.funcPromises = [];
    this.queue = [];
  }

  next() {
    if (this.queue.length > 0) {
      const { func, resolve, reject } = this.queue.shift()!;
      const promise = func()
        .then(resolve, reject)
        .finally(() => {
          // Remove the promise from the active promise list and kick off
          // the next promise
          pullFromArray(this.activePromises, promise);
          this.next();
        });
      this.activePromises.push(promise);
    }
  }
}

interface QueueEntry {
  func: () => Promise<any>;
  resolve: () => void;
  reject: () => void;
}

function isRemoteEnvironment(environment: EnvironmentSpec) {
  return environment.browserName !== 'node';
}

function isLocalEnvironment(environment: EnvironmentSpec) {
  return !isRemoteEnvironment(environment);
}

function isTsLoaderIsEnabled() {
  return typeof require.extensions['.ts'] !== 'undefined';
}
