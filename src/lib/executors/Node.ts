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
import global from '@dojo/shim/global';
import Task, { State } from '@dojo/core/async/Task';
import { deepMixin, mixin } from '@dojo/core/lang';
import Command from '@theintern/leadfoot/Command';
import LeadfootServer from '@theintern/leadfoot/Server';
import Tunnel, {
	TunnelOptions,
	DownloadProgressEvent
} from '@theintern/digdug/Tunnel';

// Dig Dug tunnels
import BrowserStackTunnel, {
	BrowserStackOptions
} from '@theintern/digdug/BrowserStackTunnel';
import SeleniumTunnel, {
	SeleniumOptions
} from '@theintern/digdug/SeleniumTunnel';
import SauceLabsTunnel from '@theintern/digdug/SauceLabsTunnel';
import TestingBotTunnel from '@theintern/digdug/TestingBotTunnel';
import CrossBrowserTestingTunnel from '@theintern/digdug/CrossBrowserTestingTunnel';
import NullTunnel from '@theintern/digdug/NullTunnel';

import Executor, { Config as BaseConfig, Events, Plugins } from './Executor';
import { normalizePathEnding } from '../common/path';
import { parseValue, pullFromArray } from '../common/util';
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
	server: Server;
	tunnel: Tunnel;

	protected _coverageMap: CoverageMap;
	protected _coverageFiles: string[];
	protected _loadingFunctionalSuites: boolean;
	protected _instrumentBasePath: string;
	protected _instrumenter: Instrumenter;
	protected _sourceMaps: MapStore;
	protected _instrumentedMaps: MapStore;
	protected _unhookRequire: null | (() => void);
	protected _sessionSuites: Suite[];

	constructor(options?: { [key in keyof Config]?: any }) {
		super({
			basePath: process.cwd() + sep,
			capabilities: { 'idle-timeout': 60 },
			coverage: [],
			environments: [],
			functionalCoverage: true,
			functionalSuites: [],
			functionalTimeouts: { connectTimeout: 30000 },
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
		this.registerReporter(
			'benchmark',
			options => new Benchmark(this, options)
		);
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
		this.registerReporter(
			'cobertura',
			options => new Cobertura(this, options)
		);
		this.registerReporter(
			'teamcity',
			options => new TeamCity(this, options)
		);

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
			(reason: Error, promise: Promise<any>) => {
				console.warn('Unhandled rejection:', reason, promise);
				this.emit('error', reason);
			}
		);

		process.on('uncaughtException', (reason: Error) => {
			console.warn('Unhandled error:', reason);
			this.emit('error', reason);
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
			this._sessionSuites.forEach(factory);
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
			const newCode = this._instrumenter.instrumentSync(
				code,
				normalize(filename),
				sourceMap
			);

			this._coverageMap.addFileCoverage(
				this._instrumenter.lastFileCoverage()
			);
			this._instrumentedMaps.registerMap(
				filename,
				this._instrumenter.lastSourceMap()
			);

			return newCode;
		} catch (error) {
			this.emit(
				'warning',
				`Error instrumenting ${filename}: ${error.message}`
			);
			return code;
		}
	}

	/**
	 * Load scripts using Node's require
	 */
	loadScript(script: string | string[]) {
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
		return (
			this._coverageFiles && this._coverageFiles.indexOf(filename) !== -1
		);
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
				promises.push(
					this.tunnel
						.stop()
						.then(() =>
							this.emit('tunnelStop', { tunnel: this.tunnel })
						)
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
					config.functionalSuites.length +
						config.browser.suites.length >
						0) ||
				// User can start the server without planning to run functional
				// tests
				config.serveOnly
			) {
				const serverTask = new Task<void>((resolve, reject) => {
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
				});

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
								.then(() =>
									this.emit('tunnelStart', { tunnel })
								);
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
								this.executor.log(
									'Created session:',
									session.capabilities
								);

								let remote: Remote = <Remote>new Command(
									session
								);
								remote.environmentType = new Environment(
									session.capabilities
								);
								this.remote = remote;
								this.sessionId = remote.session.sessionId;

								// Update the name with details from the remote
								// environment
								this.name = remote.environmentType.toString();

								const timeouts = config.functionalTimeouts;
								let promise = Promise.resolve();
								if (timeouts.executeAsync != null) {
									promise = promise.then(() =>
										remote.setExecuteAsyncTimeout(
											timeouts.executeAsync!
										)
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
										remote.setPageLoadTimeout(
											timeouts.pageLoad!
										)
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
									if (
										suite.error != null ||
										suite.numFailedTests > 0
									) {
										return true;
									}
									return suite.tests
										.filter(isSuite)
										.some(hasError);
								}
								return tunnel.sendJobState(
									remote.session.sessionId,
									{ success: !hasError(this) }
								);
							};

							if (
								config.leaveRemoteOpen === true ||
								(config.leaveRemoteOpen === 'fail' &&
									this.numFailedTests > 0)
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
	protected _loadFunctionalSuites() {
		this._loadingFunctionalSuites = true;
		const suites = this.config.functionalSuites;
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
	protected _loadSuites() {
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

	protected _processOption(
		name: keyof Config,
		value: any,
		addToExisting: boolean
	) {
		switch (name) {
			case 'functionalBaseUrl':
			case 'serverUrl':
				this._setOption(name, parseValue(name, value, 'string'));
				break;

			case 'proxy':
				if (value == null) {
					this._setOption(name, undefined);
				} else {
					this._setOption(name, parseValue(name, value, 'string'));
				}
				break;

			case 'capabilities':
			case 'instrumenterOptions':
			case 'tunnelOptions':
				this._setOption(
					name,
					parseValue(name, value, 'object'),
					addToExisting
				);
				break;

			// Must be a string, object, or array of (string | object)
			case 'environments':
				if (!value) {
					value = [];
				} else if (!Array.isArray(value)) {
					value = [value];
				}
				value = value.map((val: any) => {
					if (typeof val === 'object' && val.browserName == null) {
						val.browserName = val.browser;
					}
					return val;
				});
				this._setOption(
					name,
					parseValue(name, value, 'object[]', 'browserName'),
					addToExisting
				);
				break;

			case 'excludeInstrumentation':
				this.emit('deprecated', {
					original: 'excludeInstrumentation',
					replacement: 'coverage'
				});
				break;

			case 'tunnel':
				this._setOption(name, parseValue(name, value, 'string'));
				break;

			case 'functionalCoverage':
			case 'leaveRemoteOpen':
			case 'serveOnly':
			case 'runInSync':
				this._setOption(name, parseValue(name, value, 'boolean'));
				break;

			case 'coverage':
				let parsed: boolean | string[];
				try {
					parsed = parseValue(name, value, 'boolean');
				} catch (error) {
					parsed = parseValue(name, value, 'string[]');
				}
				if (typeof parsed === 'boolean' && parsed !== false) {
					throw new Error("Non-false boolean for 'coverage'");
				}
				this._setOption(name, parsed);
				break;

			case 'functionalSuites':
				this._setOption(
					name,
					parseValue(name, value, 'string[]'),
					addToExisting
				);
				break;

			case 'connectTimeout':
			case 'functionalTimeouts':
				if (!this.config.functionalTimeouts) {
					this.config.functionalTimeouts = {};
				}
				if (name === 'connectTimeout') {
					this.emit('deprecated', {
						original: name,
						replacement: 'functionalTimeouts.connectTimeout'
					});
					name = 'functionalTimeouts';
					value = { connectTimeout: value };
				}
				const parsedTimeout = parseValue(name, value, 'object');
				if (parsedTimeout) {
					// If the given value was an object, mix it in to the
					// default functionalTimeouts
					Object.keys(parsedTimeout).forEach(timeoutKey => {
						const key = <keyof Config['functionalTimeouts']>timeoutKey;
						this.config.functionalTimeouts[key] = parseValue(
							`functionalTimeouts.${key}`,
							parsedTimeout[key],
							'number'
						);
					});
				} else {
					// If the given value was null/undefined, clear out
					// functionalTimeouts
					this._setOption(name, {});
				}
				break;

			case 'maxConcurrency':
			case 'serverPort':
			case 'socketPort':
				this._setOption(name, parseValue(name, value, 'number'));
				break;

			default:
				super._processOption(
					<keyof BaseConfig>name,
					value,
					addToExisting
				);
				break;
		}
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
				config[key] = normalizePathEnding(
					resolve(<string>config[key]),
					sep
				);
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

			// Ensure URLs end with a '/'
			['serverUrl', 'functionalBaseUrl'].forEach(key => {
				const property = <keyof Config>key;
				if (config[property]) {
					config[property] = (<string>config[property]).replace(
						/\/*$/,
						'/'
					);
				}
			});

			if (!config.capabilities.name) {
				config.capabilities.name = 'intern';
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
				mixin(
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

	protected _runTests() {
		let testTask: Task<void>;

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
				if (testTask && testTask.state === State.Pending) {
					testTask.cancel();
				}
			}
		).finally(() => {
			// For all files that are marked for coverage that weren't read,
			// read the file and instrument the code (adding it to the overall
			// coverage map)
			const coveredFiles = this._coverageMap.files();
			const uncoveredFiles = this._coverageFiles.filter(filename => {
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

	protected _runRemoteTests() {
		const config = this.config;
		const sessionSuites = this._sessionSuites;
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
				this.log('Emitting coverage');
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
			this._unhookRequire = null;
		}
	}
}

export interface NodePlugins extends Plugins {
	tunnel: typeof Tunnel;
}

export interface Config extends BaseConfig {
	/**
	 * The default capabilities for all test environments.
	 *
	 * They will be extended for each environment by values in the
	 * [`environments`](#environments) array.
	 *
	 * Cloud testing services such as BrowserStack may have unique capabilities.
	 * It’s important to use the proper capabilities for the WebDriver server or
	 * cloud service being used to run tests.
	 *
	 * * [Selenium capabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
	 * * [BrowserStack capabilities](https://www.browserstack.com/automate/capabilities)
	 * * [CrossBrowserTesting capabilities](https://help.crossbrowsertesting.com/selenium-testing/automation-capabilities)
	 * * [Sauce Labs capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-Selenium-SpecificOptions) and [environments](https://saucelabs.com/platforms)
	 * * [TestingBot capabilities](https://testingbot.com/support/other/test-options) and [environments](https://testingbot.com/support/getting-started/browsers.html)
	 *
	 * [Chrome-specific options](https://sites.google.com/a/chromium.org/chromedriver/capabilities)
	 * may be passed using a `chromeOptions` capability.
	 *
	 * Intern will automatically provide certain capabilities to provide better
	 * feedback with cloud service dashboards:
	 *
	 * * `name` will be set to the name of the test config
	 * * `build` will be set to the commit ID from the `TRAVIS_COMMIT` and
	 *   `BUILD_TAG` environment variables, if either exists
	 */
	capabilities: {
		name?: string;
		build?: string;
		[key: string]: any;
	};

	// Deprecated; this is only here for typing
	connectTimeout: never;

	/**
	 * Timeouts that apply to functional tests.
	 *
	 *   * **connectTimeout** is the time to wait for contact from a remote
	 *     server
	 *   * **find** is the time to wait for findBy commands to find an element
	 *   * **executeAsync** is the time to wait for executeAsync calls to
	 *     complete
	 *   * **pageLoad** is the time to wait for a page to finish loading
	 *     synchronous resources
	 */
	functionalTimeouts: {
		/** Time to wait for contact from a remote server */
		connectTimeout?: number;

		/** Time to wait for a findBy command to find a matching element */
		find?: number;

		/** Time to wait for an executeAsync to complete */
		executeAsync?: number;

		/** Time to wait for initial page load to complete */
		pageLoad?: number;
	};

	/**
	 * An array of file paths or globs that should be instrumented for code
	 * coverage, or false to completely disable coverage.
	 *
	 * This property should point to the actual JavaScript files that will be
	 * executed, not pre-transpiled sources (coverage results will still be
	 * mapped back to original sources). Coverage data will be collected for
	 * these files even if they’re not loaded by Intern for tests, allowing a
	 * test writer to see which files _haven’t_ been tested, as well as coverage
	 * on files that were tested.
	 *
	 * When this value is unset, Intern will still look for coverage data on a
	 * global coverage variable, and it will request coverage data from remote
	 * sessions. Explicitly setting coverage to false will prevent Intern from
	 * even checking for coverage data.
	 *
	 * > 💡This property replaces the `excludeInstrumentation` property used in
	 * previous versions of Intern, which acted as a filter rather than an
	 * inclusive list.
	 */
	coverage: false | string[];

	/**
	 * The environments that will be used to run tests.
	 *
	 * Its value can be a single browser name or an environment object, or an
	 * array of these.
	 *
	 * ```js
	 * environments: 'chrome'
	 * environments: ['chrome', 'firefox']
	 * environments: { browserName: 'chrome', version: '57.0' }
	 * environments: { browserName: 'chrome', fixSessionCapabilities: false }
	 * ```
	 *
	 * The syntax for browser names and other properties depends on where tests
	 * are being run. For example, when running tests using a local Selenium
	 * server, the browser name should be the lowercase name of a locally
	 * available browser, such as ‘chrome’ or ‘firefox’, and other properties
	 * such as the platform name will generally be ignored. When running on a
	 * cloud testing service such as [Sauce Labs](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-RequiredSeleniumTestConfigurationSettings)
	 * or [BrowserStack](https://www.browserstack.com/automate/capabilities),
	 * browser names and other properties may have different acceptable values
	 * (e.g., ‘googlechrome’ instead of ‘chrome’, or ‘MacOS’ vs ‘OSX’).
	 *
	 * The [fixSessionCapabilities](https://theintern.io/docs.html#Leadfoot/2/api/Server/fixsessioncapabilities)
	 * property determines whether feature and defect tests will be run in the
	 * remote browser. Setting it to `false` entirely disables feature tests
	 * (assuming that all features are enabled), while setting it to
	 * `'no-detect'` will set certain already-known feature and defect flags
	 * based on the browser and platform. The current set of capabilities are
	 * available on `this.remote.session.capabilities` in functional tests.
	 *
	 * > 💡Note that 'node' is an environment. If no environments are specified,
	 * the Node executor will automatically add 'node' to the resolved config.
	 * If any environments are specified, though, unit tests will only be run in
	 * this environments.
	 */
	environments: EnvironmentSpec[];

	// Deprecated; this is only here for typing
	excludeInstrumentation: never;

	/** The base URL to use for relative addresses in functional tests */
	functionalBaseUrl?: string;

	/** Whether to collect coverage data from functional tests */
	functionalCoverage: boolean;

	/**
	 * A list of paths or glob expressions that point to functional suites.
	 *
	 * Functional suites are files that register
	 * [WebDriver tests](writing_tests.md).
	 */
	functionalSuites: string[];

	/**
	 * An object containing options for the
	 * [Istanbul instrumenter](https://github.com/istanbuljs/istanbuljs/blob/master/packages/istanbul-lib-instrument/api.md#instrumenter).
	 */
	instrumenterOptions: { [key: string]: any };

	/**
	 * Whether to leave the remote browser open after testing.
	 *
	 * Normally when Intern runs tests on remote browsers, it shuts the browser
	 * down when testing is finished. However, you may sometimes want to inspect
	 * the state of a remote browser after tests have run, particularly if
	 * you're trying to debug why a test is failing. Setting `leaveRemoteOpen`
	 * to true will cause Intern to leave the browser open after testing.
	 * Setting it to `'fail'` will cause Intern to leave it open only if there
	 * were test failures.
	 */
	leaveRemoteOpen: boolean | 'fail';

	/**
	 * The number of concurrent remote test sessions to run at once.
	 *
	 * The default value is Infinity, meaning Intern will try to run all of its
	 * test sessions in parallel. Note that cloud testing services often limit
	 * the number of concurrent sessions they will allow to 2 or 5.
	 */
	maxConcurrency: number;

	/**
	 * A proxy that should be used for outgoing web connections. If specified,
	 * this will be used for Intern's WebDriver client instead of the Dig Dug
	 * tunnel's proxy value.
	 */
	proxy?: string;

	/**
	 * If true, a remote will wait for reponses from Intern for any executor
	 * events.
	 */
	runInSync: boolean;

	/** If true, start Intern's static test server but do not run any tests. */
	serveOnly: boolean;

	/**
	 * The port Intern's static server will listen on during functional tests.
	 */
	serverPort: number;

	/**
	 * The URL a remote should use to access Intern's static server. By default
	 * this is http://localhost:9000, but the domain or port may be different if
	 * Intern is behind a proxy.
	 */
	serverUrl: string;

	/**
	 * The port that a remote will use to access Intern's websocket server. The
	 * hostname will be the same as for serverUrl. For example, if serverPort is
	 * set to 9001 and the default serverUrl is used (http://localhost:9000),
	 * the full websocket URL will be ws://localhost:9001.
	 */
	socketPort?: number;

	/**
	 * The Dig Dug tunnel class to use for WebDriver testing.
	 *
	 * There are several built in tunnel types, and others can be added through
	 * the Node executor’s [`registerPlugin`
	 * method](./architecture.md#extension-points).
	 *
	 * The built in tunnel classes are:
	 *
	 * * 'null'
	 * * 'selenium'
	 * * 'browserstack'
	 * * 'cbt' (CrossBrowserTesting)
	 * * 'saucelabs'
	 * * 'testingbot'
	 */
	tunnel: string;

	/**
	 * Options for the currently selected tunnel.
	 *
	 * The available options depend on the current tunnel. Common options
	 * include:
	 *
	 * ** All tunnels**
	 *
	 * | Property   | Value                                                    |
	 * | :---       | :---                                                     |
	 * | `username` | Username for the tunnel service (e.g., BrowserStack)     |
	 * | `apiKey`   | API key for the tunnel service (e.g., BrowserStack)      |
	 * | `pathname` | The path for the tunnel’s REST endpoint (e.g., `wd/hub`) |
	 *
	 * **Selenium tunnel**
	 *
	 * | Property  | Value                                                                   |
	 * | :---      | :---                                                                    |
	 * | `drivers` | A list of driver names, or objects with `name` and `options` properties |
	 * | `verbose` | If true, show tunnel debug information                                  |
	 *
	 * See also:
	 *
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/Tunnel/tunnelproperties|Tunnel]]
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/SeleniumTunnel/seleniumproperties|SeleniumTunnel]]
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/BrowserStackTunnel/browserstackproperties|BrowserStackTunnel]]
	 */
	tunnelOptions: TunnelOptions | BrowserStackOptions | SeleniumOptions;
}

export interface Remote extends Command<any> {
	environmentType?: Environment;
	setHeartbeatInterval(delay: number): Command<any>;
}

export interface EnvironmentSpec {
	browserName: string;
	[key: string]: any;
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
	activeTasks: Task<any>[];
	funcTasks: Task<any>[];

	constructor(maxConcurrency: number) {
		this.maxConcurrency = maxConcurrency;
		this.queue = [];
		this.activeTasks = [];
		this.funcTasks = [];
	}

	enqueue(func: () => Task<any>) {
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
	func: () => Task<any>;
	resolve: () => void;
	reject: () => void;
}

function isRemoteEnvironment(environment: EnvironmentSpec) {
	return environment.browserName !== 'node';
}

function isLocalEnvironment(environment: EnvironmentSpec) {
	return !isRemoteEnvironment(environment);
}
