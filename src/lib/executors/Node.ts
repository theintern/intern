import Executor, { Config as BaseConfig, Events as BaseEvents, Plugins } from './Executor';
import Task, { State } from '@dojo/core/async/Task';
import { parseValue, pullFromArray } from '../common/util';
import { expandFiles, normalizePath, readSourceMap } from '../node/util';
import { readFileSync } from 'fs';
import { deepMixin, mixin } from '@dojo/core/lang';
import ErrorFormatter from '../node/ErrorFormatter';
import { dirname, normalize, relative, resolve, sep } from 'path';
import LeadfootServer from '@theintern/leadfoot/Server';
import ProxiedSession from '../ProxiedSession';
import Environment from '../Environment';
import resolveEnvironments from '../resolveEnvironments';
import Command from '@theintern/leadfoot/Command';
import Tunnel, { TunnelOptions, DownloadProgressEvent } from '@theintern/digdug/Tunnel';
import Server from '../Server';
import Suite, { isSuite } from '../Suite';
import RemoteSuite from '../RemoteSuite';
import { RuntimeEnvironment } from '../types';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
import { createInstrumenter, Instrumenter, readInitialCoverage } from 'istanbul-lib-instrument';
import { createSourceMapStore, MapStore } from 'istanbul-lib-source-maps';
import { hookRunInThisContext, hookRequire, unhookRunInThisContext } from 'istanbul-lib-hook';
import global from '@dojo/shim/global';

// Dig Dug tunnels
import BrowserStackTunnel, { BrowserStackOptions } from '@theintern/digdug/BrowserStackTunnel';
import SeleniumTunnel, { SeleniumOptions } from '@theintern/digdug/SeleniumTunnel';
import SauceLabsTunnel from '@theintern/digdug/SauceLabsTunnel';
import TestingBotTunnel from '@theintern/digdug/TestingBotTunnel';
import CrossBrowserTestingTunnel from '@theintern/digdug/CrossBrowserTestingTunnel';
import NullTunnel from '@theintern/digdug/NullTunnel';

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

const console: Console = global.console;
const process: NodeJS.Process = global.process;

export default class Node extends Executor<Events, Config, NodePlugins> {
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
			connectTimeout: 30000,
			environments: [],
			functionalCoverage: true,
			functionalSuites: [],
			instrumenterOptions: {},
			maxConcurrency: Infinity,
			name: 'node',
			reporters: [],
			runInSync: false,
			serveOnly: false,
			serverPort: 9000,
			serverUrl: 'http://localhost:9000',
			socketPort: 9001,
			tunnel: 'selenium',
			tunnelOptions: { tunnelId: String(Date.now()) }
		});

		this._sourceMaps = createSourceMapStore();
		this._instrumentedMaps = createSourceMapStore();
		this._errorFormatter = new ErrorFormatter(this);
		this._coverageMap = createCoverageMap();

		this.registerReporter('pretty', Pretty);
		this.registerReporter('simple', Simple);
		this.registerReporter('runner', Runner);
		this.registerReporter('benchmark', Benchmark);
		this.registerReporter('junit', JUnit);
		this.registerReporter('jsoncoverage', JsonCoverage);
		this.registerReporter('htmlcoverage', HtmlCoverage);
		this.registerReporter('lcov', Lcov);
		this.registerReporter('cobertura', Cobertura);
		this.registerReporter('teamcity', TeamCity);

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
			if (!this._listeners['error'] || this._listeners['error'].length === 0) {
				console.warn('Unhandled rejection:', promise);
			}
			reason.message = 'Unhandled rejection: ' + reason.message;
			this.emit('error', reason);
		});

		process.on('uncaughtException', (reason: Error) => {
			if (!this._listeners['error'] || this._listeners['error'].length === 0) {
				console.warn('Unhandled error:', reason);
			}
			reason.message = 'Uncaught exception: ' + reason.message;
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

	/**
	 * The root suites managed by this executor
	 */
	get suites() {
		if (this._sessionSuites) {
			return this._sessionSuites.concat([this._rootSuite]);
		}
		return [ this._rootSuite ];
	}

	/**
	 * Override Executor#addSuite to handle functional suites
	 */
	addSuite(factory: (parentSuite: Suite) => void) {
		if (this._loadingFunctionalSuites) {
			this._sessionSuites.forEach(factory);
		}
		else {
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
			const newCode = this._instrumenter.instrumentSync(code, normalize(filename), sourceMap);
			this._instrumentedMaps.registerMap(filename, this._instrumenter.lastSourceMap());
			return newCode;
		}
		catch (error) {
			this.emit('warning', `Error instrumenting ${filename}: ${error.message}`);
			return code;
		}
	}

	/**
	 * Load scripts using Node's require
	 */
	loadScript(script: string | string[]) {
		if (!Array.isArray(script)) {
			script = [script];
		}

		try {
			script.forEach(script => {
				require(resolve(script));
			});
		}
		catch (error) {
			return Task.reject<void>(error);
		}

		return Task.resolve();
	}

	/**
	 * Register a tunnel constructor with the plugin system. It can be retrieved later with getTunnel or getPlugin.
	 */
	registerTunnel(name: string, Ctor: typeof Tunnel) {
		this.registerPlugin('tunnel', name, () => Ctor);
	}

	/**
	 * Return true if a given file should be instrumented based on the current config
	 */
	shouldInstrumentFile(filename: string) {
		const excludeInstrumentation = this.config.excludeInstrumentation;
		if (excludeInstrumentation === true) {
			return false;
		}

		const basePath = this._instrumentBasePath;
		filename = normalizePath(filename);
		if (filename.indexOf(basePath) !== 0) {
			return false;
		}

		if (excludeInstrumentation && !excludeInstrumentation.test(filename.slice(basePath.length))) {
			return false;
		}

		if (this._coverageFiles && this._coverageFiles.indexOf(filename) === -1) {
			return false;
		}

		return true;
	}

	protected _afterRun() {
		return super._afterRun()
			.finally(() => {
				this._removeInstrumentationHooks();

				const promises: Promise<any>[] = [];
				if (this.server) {
					promises.push(this.server.stop().then(() => this.emit('serverEnd', this.server)));
				}
				if (this.tunnel) {
					promises.push(this.tunnel.stop().then(() => this.emit('tunnelStop', { tunnel: this.tunnel })));
				}
				// We do not want to actually return an array of values, so chain a callback that resolves to undefined
				return Promise.all(promises).then(
					() => { },
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
				config.environments.length > 0 && (config.functionalSuites.length + config.suites.length + config.browser.suites.length > 0) ||
				// User can start the server without planning to run functional tests
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

					server.start()
						.then(() => {
							this.server = server;
							return this.emit('serverStart', server);
						})
						.then(resolve, reject);
				});

				// If we're in serveOnly mode, just start the server server. Don't create session suites or start a tunnel.
				if (config.serveOnly) {
					return serverTask.then(() => {
						// In serveOnly mode we just start the server to static file serving and instrumentation. Return
						// an unresolved Task to pause indefinitely until canceled.
						return new Task<boolean>(resolve => {
							process.on('SIGINT', () => {
								resolve(true);
							});
						});
					});
				}

				return serverTask
					.then(() => {
						if (config.tunnel === 'browserstack') {
							const options = <BrowserStackOptions>config.tunnelOptions;
							options.servers = options.servers || [];
							options.servers.push(config.serverUrl);
						}

						let TunnelConstructor = this.getTunnel(config.tunnel);
						const tunnel = this.tunnel = new TunnelConstructor(this.config.tunnelOptions);

						tunnel.on('downloadprogress', progress => {
							this.emit('tunnelDownloadProgress', { tunnel, progress });
						});

						tunnel.on('status', status => {
							this.emit('tunnelStatus', { tunnel, status: status.status });
						});

						config.capabilities = deepMixin(tunnel.extraCapabilities, config.capabilities);

						return this._createSessionSuites().then(() => {
							return tunnel.start().then(() => this.emit('tunnelStart', { tunnel }));
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
	 * Creates suites for each environment in which tests will be executed. This method will only be called if there are
	 * both environments and suites to run.
	 */
	protected _createSessionSuites() {
		const tunnel = this.tunnel;
		const config = this.config;

		const leadfootServer = new LeadfootServer(tunnel.clientUrl, {
			proxy: tunnel.proxy
		});

		const executor = this;

		// Create a subclass of ProxiedSession here that will ensure the executor is set
		class InitializedProxiedSession extends ProxiedSession {
			executor = executor;
			coverageEnabled = config.functionalCoverage && config.excludeInstrumentation !== true;
			coverageVariable = config.coverageVariable;
			serverUrl = config.serverUrl;
			serverBasePathLength = config.basePath.length;
		}

		leadfootServer.sessionConstructor = InitializedProxiedSession;

		return tunnel.getEnvironments().then(tunnelEnvironments => {
			this._sessionSuites = resolveEnvironments(
				config.capabilities,
				config.environments,
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
						return leadfootServer.createSession<ProxiedSession>(environmentType).then(_session => {
							session = _session;
							this.executor.log('Created session:', session.capabilities);

							let remote: Remote = <Remote>new Command(session);
							remote.environmentType = new Environment(session.capabilities);
							this.remote = remote;
							this.sessionId = remote.session.sessionId;

							// Update the name with details from the remote environment
							this.name = remote.environmentType.toString();
						});
					},

					after() {
						const remote = this.remote;

						if (remote) {
							const endSession = () => {
								// Check for an error in this suite or a sub-suite. This check is a bit more
								// involved than just checking for a local suite error or failed tests since
								// sub-suites may have failures that don't result in failed tests.
								function hasError(suite: Suite): boolean {
									if (suite.error != null || suite.numFailedTests > 0) {
										return true;
									}
									return suite.tests.filter(isSuite).some(hasError);
								}
								return tunnel.sendJobState(remote.session.sessionId, { success: !hasError(this) });
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

				// If browser-compatible unit tests were added to this executor, add a RemoteSuite to the session suite.
				// The RemoteSuite will run the suites listed in config.suites and config.browser.suites.
				if (config.suites.length + config.browser.suites.length > 0) {
					suite.add(new RemoteSuite({
						before() {
							session.coverageEnabled = config.excludeInstrumentation !== true;
						}
					}));
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
			.then(() => { this.log('Loaded functional suites:', suites); })
			.finally(() => { this._loadingFunctionalSuites = false; });
	}

	protected _processOption(name: keyof Config, value: any, addToExisting: boolean) {
		switch (name) {
			case 'serverUrl':
				this._setOption(name, parseValue(name, value, 'string'));
				break;

			case 'capabilities':
			case 'instrumenterOptions':
			case 'tunnelOptions':
				this._setOption(name, parseValue(name, value, 'object'));
				break;

			// Must be a string, object, or array of (string | object)
			case 'environments':
				if (!value) {
					value = [];
				}
				else if (!Array.isArray(value)) {
					value = [value];
				}
				value = value.map((val: any) => {
					if (typeof val === 'object' && val.browserName == null) {
						val.browserName = val.browser;
					}
					return val;
				});
				this._setOption(name, parseValue(name, value, 'object[]', 'browserName'), addToExisting);
				break;

			case 'excludeInstrumentation':
				this.emit('deprecated', {
					original: 'excludeInstrumentation',
					replacement: 'coverage'
				});
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
			case 'functionalSuites':
				this._setOption(name, parseValue(name, value, 'string[]'), addToExisting);
				break;

			case 'connectTimeout':
			case 'maxConcurrency':
			case 'serverPort':
			case 'socketPort':
				this._setOption(name, parseValue(name, value, 'number'));
				break;

			default:
				super._processOption(<keyof BaseConfig>name, value, addToExisting);
				break;
		}
	}

	protected _resolveConfig() {
		return super._resolveConfig().then(() => {
			const config = this.config;

			if (!config.internPath) {
				config.internPath = dirname(dirname(__dirname));
			}

			config.internPath = normalizePath(`${relative(process.cwd(), config.internPath)}${sep}`);
			if (/^\.\.\//.test(config.internPath)) {
				throw new Error(`Invalid internPath "${config.internPath}". If the intern package is symlinked, `
					+ 'config.internPath must be set manually.');
			}

			if (config.benchmarkConfig) {
				config.reporters.push({
					name: 'benchmark',
					options: config.benchmarkConfig
				});
			}

			this._instrumentBasePath = normalizePath(`${resolve(config.basePath || '')}${sep}`);
			this._coverageFiles = [];

			if (config.coverage) {
				// Coverage file entries should be absolute paths
				this._coverageFiles = expandFiles(config.coverage).map(path => resolve(path));
			}

			config.serverUrl = config.serverUrl.replace(/\/*$/, '/');

			if (!config.capabilities.name) {
				config.capabilities.name = 'intern';
			}

			const buildId = process.env.TRAVIS_COMMIT || process.env.BUILD_TAG;
			if (buildId) {
				config.capabilities.build = buildId;
			}

			// Expand suite globs
			config.suites = expandFiles(config.suites);
			config.functionalSuites = expandFiles(config.functionalSuites);

			// Expand suite globs in node, browser objects
			config.node.suites = expandFiles(config.node.suites);
			config.browser.suites = expandFiles(config.browser.suites);

			// Install the instrumenter in resolve config so it will be able to handle suites
			this._instrumenter = createInstrumenter(mixin({}, {
				coverageVariable: config.coverageVariable,
				...config.instrumenterOptions
			}, {
				preserveComments: true,
				produceSourceMap: true
			}));

			if (config.excludeInstrumentation !== true) {
				this._setInstrumentationHooks();
			}
		});
	}

	protected _runTests() {
		let testTask: Task<void>;
		return new Task<void>(
			(resolve, reject) => {
				super._runTests()
					.then(() => {
						if (!this._sessionSuites) {
							return;
						}
						return this._loadFunctionalSuites()
							.then(() => testTask = this._runRemoteTests());
					})
					.then(resolve, reject);
			},
			() => {
				if (testTask && testTask.state === State.Pending) {
					testTask.cancel();
				}
			}
		);
	}

	protected _runRemoteTests() {
		const config = this.config;
		const sessionSuites = this._sessionSuites;
		const queue = new FunctionQueue(config.maxConcurrency || Infinity);

		this.log('Running', sessionSuites.length, 'suites with maxConcurrency', config.maxConcurrency);

		const runTask = new Task((resolve, reject) => {
			Task.all(sessionSuites.map(suite => {
				this.log('Queueing suite', suite.name);
				return queue.enqueue(() => {
					this.log('Running suite', suite.name);
					return suite.run();
				});
			})).then(resolve, reject);
		}, () => {
			this.log('Canceling remote tests');
			queue.clear();
		});

		return runTask
			.then(() => { })
			.finally(() => {
				if (config.functionalCoverage !== false) {
					// Collect any local coverage generated by functional tests
					this.log('Emitting coverage');
					return this._emitCoverage('functional tests');
				}
			})
			.finally(() => {
				// If coverage is set, generate initial coverage data for files with no coverage results
				const filesWithCoverage = this._coverageMap.files();
				this._coverageFiles
					.filter(path => filesWithCoverage.indexOf(path) === -1)
					.forEach(filename => {
						const code = readFileSync(filename, { encoding: 'utf8' });
						const instrumentedCode = this.instrumentCode(code, filename);
						const coverage = readInitialCoverage(instrumentedCode);
						this._coverageMap.addFileCoverage(coverage.coverageData);
					});
			});
	}

	/**
	 * Adds hooks for code coverage instrumentation in the Node.js loader.
	 */
	protected _setInstrumentationHooks() {
		hookRunInThisContext(filename => this.shouldInstrumentFile(filename),
			(code, filename) => this.instrumentCode(code, filename));
		this._unhookRequire = hookRequire(filename => this.shouldInstrumentFile(filename),
			(code, filename) => this.instrumentCode(code, filename));
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
	capabilities: {
		name?: string;
		build?: string;
		[key: string]: any;
	};

	/** Time to wait for contact from a remote server */
	connectTimeout: number;

	/**
	 * A list of globs denoting which files coverage data should be collected for. Files may be excluded by prefixing an
	 * expression with '!'.
	 */
	coverage: string[];

	/** A list of remote environments */
	environments: EnvironmentSpec[];

	/** A regexp matching file names that shouldn't be instrumented, or `true` to disable instrumentation. */
	excludeInstrumentation: true | RegExp;

	/** If true, collect coverage data from functional tests */
	functionalCoverage: boolean;

	functionalSuites: string[];

	instrumenterOptions: { [key: string]: any };

	leaveRemoteOpen: boolean | 'fail';
	maxConcurrency: number;

	serveOnly: boolean;
	serverPort: number;
	serverUrl: string;
	runInSync: boolean;
	socketPort?: number;
	tunnel: string;
	tunnelOptions?: TunnelOptions | BrowserStackOptions | SeleniumOptions;
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

export interface Events extends BaseEvents {
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
 * A basic FIFO function queue to limit the number of currently executing asynchronous functions.
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
			const task = func().then(resolve, reject).finally(() => {
				// Remove the task from the active task list and kick off the next task
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
