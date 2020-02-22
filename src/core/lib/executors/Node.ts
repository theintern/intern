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
import { register } from 'ts-node';
import { global, deepMixin } from '../../../common';
import Command from '../../../webdriver/Command';
import LeadfootServer from '../../../webdriver/Server';
import Tunnel, { DownloadProgressEvent } from '../../../tunnels/Tunnel';

// Dig Dug tunnels
import SeleniumTunnel, {
  DriverDescriptor
} from '../../../tunnels/SeleniumTunnel';
import BrowserStackTunnel, {
  BrowserStackOptions
} from '../../../tunnels/BrowserStackTunnel';
import SauceLabsTunnel from '../../../tunnels/SauceLabsTunnel';
import TestingBotTunnel from '../../../tunnels/TestingBotTunnel';
import CrossBrowserTestingTunnel from '../../../tunnels/CrossBrowserTestingTunnel';
import NullTunnel from '../../../tunnels/NullTunnel';

import { Config, EnvironmentSpec } from '../common/config';
import Executor, { Events, Plugins } from './Executor';
import { normalizePathEnding } from '../common/path';
import { pullFromArray } from '../common/util';
import { expandFiles, readSourceMap, transpileSource } from '../node/util';
import ErrorFormatter from '../node/ErrorFormatter';
import ProxiedSession from '../ProxiedSession';
import Environment from '../Environment';
import resolveEnvironments from '../resolveEnvironments';
import Server from '../Server';
import Suite, { isSuite, isFailedSuite } from '../Suite';
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
  protected _coverageFiles: { [filename: string]: boolean } | undefined;
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
      functionalRetries: 0,
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
    return (
      this._coverageFiles && Object.entries(this._coverageFiles).length > 0
    );
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
      return code;
    }

    if (shouldCompile) {
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
   * Return true if a given file should be instrumented based on the current
   * config
   */
  shouldInstrumentFile(filename: string) {
    if (!this._coverageFiles || !(filename in this._coverageFiles)) {
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
    const tunnelOptions = config.tunnelOptions;
    if (config.tunnel === 'browserstack') {
      const options = <BrowserStackOptions>tunnelOptions;
      options.servers = options.servers || [];
      options.servers.push(config.serverUrl);
    }

    if ('proxy' in config && !('proxy' in tunnelOptions)) {
      tunnelOptions.proxy = config.proxy;
    }

    const TunnelConstructor = this.getTunnel(config.tunnel);
    const tunnel = new TunnelConstructor(this.config.tunnelOptions);
    this.tunnel = tunnel;

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

    const tunnel = this.tunnel;
    const config = this.config;

    const leadfootServer = new LeadfootServer(tunnel.clientUrl, {
      proxy: 'proxy' in config ? config.proxy : tunnel.proxy
    });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Create a subclass of ProxiedSession here that will ensure the
    // executor is set
    class InitializedProxiedSession extends ProxiedSession {
      executor = self;
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
            self.log('Creating session for', environmentType);
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
        if (config.browser.suites.length > 0) {
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

  protected _resolveConfig() {
    return super._resolveConfig().then(() => {
      this.log('resolving Node config');

      this._cancelToken.throwIfCancelled();

      const config = this.config;

      if (config.environments.length === 0) {
        this.log("Adding default 'node' environment");
        config.environments.push({ browserName: 'node' });
      }

      // Normalize browser names
      config.environments.forEach(env => {
        const newName = getNormalizedBrowserName(env)!;
        env.browserName = newName;
        if (env.browser) {
          env.browser = newName;
        }
      });

      // Normalize tunnel driver names
      if (config.tunnelOptions.drivers) {
        config.tunnelOptions.drivers = config.tunnelOptions.drivers.map(
          driver => {
            let driverName: string | undefined;

            if (typeof driver === 'string') {
              driverName = driver;
            } else if ('name' in driver) {
              driverName = driver.name;
            }

            const newName = getNormalizedBrowserName(driverName);

            if (typeof driver === 'string') {
              return newName! as DriverDescriptor;
            }

            if ('name' in driver) {
              return {
                ...driver,
                name: newName!
              };
            }

            return driver;
          }
        );
      }

      if (!config.internPath) {
        config.internPath = dirname(dirname(dirname(__dirname)));

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

      (['basePath', 'internPath'] as ('basePath' | 'internPath')[]).forEach(
        property => {
          config[property] = normalizePathEnding(
            resolve(config[property]),
            sep
          );
        }
      );

      if (config.benchmarkConfig) {
        config.reporters.push({
          name: 'benchmark',
          options: config.benchmarkConfig
        });
      }

      this._instrumentBasePath = config.basePath;
      this._coverageFiles = {};

      if (config.coverage) {
        // Coverage file entries should be absolute paths
        const coverageFiles = expandFiles(config.coverage).map(path =>
          resolve(path)
        );
        for (const file of coverageFiles) {
          this._coverageFiles[file] = false;
        }
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
      (['serverUrl', 'functionalBaseUrl'] as (
        | 'serverUrl'
        | 'functionalBaseUrl'
      )[]).forEach(property => {
        if (config[property]) {
          config[property] = config[property]!.replace(/\/*$/, '/');
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

      if (!require.extensions['.ts']) {
        if (
          ((config.node &&
            config.node.suites.some(pattern => pattern.endsWith('.ts'))) ||
            (config.plugins &&
              config.plugins.some(plugin => plugin.script.endsWith('.ts')))) &&
          typeof this.config.node.tsconfig === 'undefined'
        ) {
          register();
        } else if (this.config.node.tsconfig) {
          register({ project: this.config.node.tsconfig });
        }
      }

      // Install the instrumenter in resolve config so it will be able to
      // handle suites
      this._instrumenter = createInstrumenter(
        Object.assign(
          {
            esModules: true,
            coverageVariable: config.coverageVariable,
            ...config.instrumenterOptions
          },
          {
            preserveComments: true,
            produceSourceMap: true
          }
        )
      );

      // If we're using the Selenium tunnel and the user hasn't specified any
      // drivers, try to figure out what they might need.
      if (config.tunnel === 'selenium') {
        const driverNames = this._getSeleniumDriverNames();

        const { tunnelOptions } = config;
        if (tunnelOptions.drivers) {
          // Remove all the driver names from driverNames that are already
          // specified in tunnelOptions.drivers
          tunnelOptions.drivers
            .map(driver => {
              if (typeof driver === 'string') {
                return driver;
              }
              return (driver as any).name;
            })
            .filter(name => name)
            .forEach(name => {
              const index = driverNames.indexOf(name);
              if (index !== -1) {
                driverNames.splice(index, 1);
              }
            });
          // Mix the required driverNames into the drivers already in the config
          tunnelOptions.drivers = [
            ...tunnelOptions.drivers,
            ...driverNames.map(name => ({ name }))
          ];
        } else {
          tunnelOptions.drivers = driverNames.map(name => ({ name }));
        }
      }

      // If there are remote environments, resolve them using environments
      // available through the tunnel specified in the config.
      const remoteEnvironments = config.environments.filter(
        isRemoteEnvironment
      );
      if (remoteEnvironments.length > 0 && config.tunnel) {
        const tunnel = this._createTunnel();

        // Add any extra capabilites provided by the tunnel to the config's
        // capabilities
        config.capabilities = deepMixin(
          tunnel.extraCapabilities,
          config.capabilities
        );

        return this._cancelToken
          .wrap(tunnel.getEnvironments())
          .then(tunnelEnvironments => {
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
            config.environments = [
              ...localEnvironments,
              ...resolvedEnvironments
            ];
          });
      }
    });
  }

  /**
   * Return the names of all the selenium drivers that should be needed based
   * on the environments specified in the config.
   */
  protected _getSeleniumDriverNames(): string[] {
    const { config } = this;
    const driverNames = new Set<string>();

    for (const env of config.environments) {
      const { browserName } = env;
      if (
        browserName === 'chrome' ||
        browserName === 'firefox' ||
        browserName === 'internet explorer'
      ) {
        driverNames.add(browserName);
      } else if (browserName === 'MicrosoftEdge') {
        const { browserVersion } = env;
        if (
          (!isNaN(browserVersion) && Number(browserVersion) < 1000) ||
          // 'insider preview' may be used to specify Edge Chromium before it is
          // official released
          (isNaN(browserVersion) && browserVersion === 'insider preview')
        ) {
          driverNames.add('MicrosoftEdgeChromium');
        } else {
          driverNames.add('MicrosoftEdge');
        }
      }
    }

    return Array.from<string>(driverNames);
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
      uncoveredFiles.forEach(filename => {
        try {
          const code = readFileSync(filename, { encoding: 'utf8' });
          this.instrumentCode(
            code,
            filename,
            filename.endsWith('.ts') || filename.endsWith('.tsx')
          );
        } catch {
          // ignored
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
        this._coverageFiles![filename] = true;
        return this.instrumentCode(code, filename);
      }
    );

    this._unhookRequire = hookRequire(
      filename => this.shouldInstrumentFile(filename),
      (code, { filename }) => {
        this._coverageFiles![filename] = true;
        return this.instrumentCode(code, filename);
      },
      { extensions: ['.js', '.jsx', '.ts', 'tsx'] }
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

function getNormalizedBrowserName(nameOrEnv: string | undefined | Environment) {
  if (nameOrEnv == null) {
    return nameOrEnv;
  }

  const name =
    typeof nameOrEnv === 'string'
      ? nameOrEnv
      : nameOrEnv.browserName || nameOrEnv.browser;
  if (name === 'ie') {
    return 'internet explorer';
  }
  if (name && /^edge/.test(name)) {
    return name.replace(/^edge/, 'MicrosoftEdge');
  }

  return name;
}
