import { initialize } from './Executor';
import { Config as BaseConfig, Events as BaseEvents, GenericNode } from './Node';
import Tunnel, { TunnelOptions, DownloadProgressEvent } from 'digdug/Tunnel';
import BrowserStackTunnel, { BrowserStackOptions } from 'digdug/BrowserStackTunnel';
import SeleniumTunnel, { SeleniumOptions } from 'digdug/SeleniumTunnel';
import SauceLabsTunnel from 'digdug/SauceLabsTunnel';
import TestingBotTunnel from 'digdug/TestingBotTunnel';
import CrossBrowserTestingTunnel from 'digdug/CrossBrowserTestingTunnel';
import NullTunnel from 'digdug/NullTunnel';
import Server from '../Server';
import { deepMixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';
import LeadfootServer from 'leadfoot/Server';
import ProxiedSession from '../ProxiedSession';
import resolveEnvironments from '../resolveEnvironments';
import Suite from '../Suite';
import RemoteSuite from '../RemoteSuite';
import { parseValue, pullFromArray, retry } from '../common/util';
import { expandFiles } from '../node/util';
import Environment from '../Environment';
import Command from 'leadfoot/Command';
import Pretty from '../reporters/Pretty';
import Benchmark from '../reporters/Benchmark';
import Runner from '../reporters/Runner';
import Promise from '@dojo/shim/Promise';

/**
 * The WebDriver executor is used to run unit tests in a remote browser, and to run functional tests against a remote
 * browser, using the WebDriver protocol.
 *
 * Unit and functional tests are handled fundamentally differently. Unit tests are only handled as module names here;
 * they will be loaded in a remote browser session, not in this executor. Functional tests, on the other hand, are loaded
 * and executed directly in this executor.
 */
export default class WebDriver extends GenericNode<Events, Config> {
	static initialize(config?: Config) {
		return initialize<Events, Config, WebDriver>(WebDriver, config);
	}

	server: Server;

	tunnel: Tunnel;

	protected _rootSuites: Suite[];

	protected _tunnels: { [name: string]: typeof Tunnel };

	constructor(config: Config) {
		const defaults: Partial<Config> = {
			capabilities: { 'idle-timeout': 60 },
			contactTimeout: 30000,
			environmentRetries: 3,
			environments: [],
			maxConcurrency: Infinity,
			reporters: [{ reporter: 'runner' }],
			tunnel: 'selenium',
			tunnelOptions: { tunnelId: String(Date.now()) }
		};

		super(deepMixin(defaults, config));

		this._tunnels = {};

		this.registerTunnel('null', NullTunnel);
		this.registerTunnel('selenium', SeleniumTunnel);
		this.registerTunnel('saucelabs', SauceLabsTunnel);
		this.registerTunnel('browserstack', BrowserStackTunnel);
		this.registerTunnel('testingbot', TestingBotTunnel);
		this.registerTunnel('cbt', CrossBrowserTestingTunnel);

		this.registerReporter('pretty', Pretty);
		this.registerReporter('runner', Runner);
		this.registerReporter('benchmark', Benchmark);
	}

	get environment() {
		return 'webdriver';
	}

	registerTunnel(name: string, Class: typeof Tunnel) {
		this._tunnels[name] = Class;
	}

	protected _afterRun() {
		return super._afterRun()
			.finally(() => {
				const promises: Promise<any>[] = [];
				if (this.server) {
					promises.push(this.server.stop().then(() => this.emit('serverEnd', this.server)));
				}
				if (this.tunnel) {
					promises.push(this.tunnel.stop().then(() => this.emit('tunnelStop', { tunnel: this.tunnel })));
				}
				return Promise.all(promises)
					// We do not want to actually return an array of values, so chain a callback that resolves to
					// undefined
					.then(() => {}, error => this.emit('error', error));
			});
	}

	protected _beforeRun() {
		const config = this.config;

		const promise = super._beforeRun().then(() => {
			const server = this._createServer();
			return server.start().then(() => {
				this.server = server;
				return this.emit('serverStart', server);
			});
		});

		// If we're in serveOnly mode, just start the server server. Don't create session suites or start a tunnel.
		if (config.serveOnly) {
			return promise.then(() => {
				// This is normally handled in Executor#run, but in serveOnly mode we short circuit the normal sequence
				// Pause indefinitely until canceled
				return new Task(() => {}).finally(() => this.server && this.server.stop());
			});
		}

		return promise
			.then(() => {
				if (config.environments.length === 0) {
					throw new Error('No environments specified');
				}

				if (config.tunnel === 'browserstack') {
					const options = <BrowserStackOptions>config.tunnelOptions;
					options.servers = (options.servers || []).concat(config.serverUrl);
				}

				if (config.functionalSuites.length + config.suites.length + config.benchmarkSuites.length > 0) {
					let TunnelConstructor = this._tunnels[config.tunnel];
					this.tunnel = new TunnelConstructor(this.config.tunnelOptions);
				}
			})
			.then(() => {
				return Promise.all(['suites', 'functionalSuites', 'benchmarkSuites'].map(property => {
					return expandFiles(config[property]).then(expanded => {
						config[property] = expanded;
					});
				// return void
				})).then(() => null);
			})
			.then(() => {
				const tunnel = this.tunnel;
				if (!tunnel) {
					return;
				}

				tunnel.on('downloadprogress', progress => {
					this.emit('tunnelDownloadProgress', { tunnel, progress });
				});

				tunnel.on('status', status => {
					this.emit('tunnelStatus', { tunnel, status: status.status });
				});

				config.capabilities = deepMixin(tunnel.extraCapabilities, config.capabilities);
			})
			.then(() => this._createSessionSuites())
			.then(() => {
				const tunnel = this.tunnel;
				if (!tunnel) {
					return;
				}

				return tunnel.start().then(() => this.emit('tunnelStart', { tunnel }));
			});
	}

	/**
	 * Creates an instrumenting server for sending instrumented code to the remote environment and receiving
	 * data back from the remote environment.
	 */
	protected _createServer() {
		// Need an explicitly declared variable for typing
		const server: Server = new Server({
			basePath: this.config.basePath,
			instrumenterOptions: this.config.instrumenterOptions,
			excludeInstrumentation: this.config.excludeInstrumentation,
			executor: this,
			instrument: true,
			port: this.config.serverPort,
			runInSync: this.config.runInSync,
			socketPort: this.config.socketPort
		});
		return server;
	}

	/**
	 * Creates suites for each environment in which tests will be executed.
	 */
	protected _createSessionSuites() {
		const tunnel = this.tunnel;
		if (!this.tunnel) {
			return;
		}

		const config = this.config;

		if (config.environments.length === 0) {
			this._rootSuites = [];
			return;
		}

		const leadfootServer = new LeadfootServer(tunnel.clientUrl, {
			proxy: tunnel.proxy
		});

		leadfootServer.sessionConstructor = ProxiedSession;

		return tunnel.getEnvironments().then(tunnelEnvironments => {
			const executor = this;

			this._rootSuites = resolveEnvironments(
				config.capabilities,
				config.environments,
				tunnelEnvironments
			).map(environmentType => {
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
						return retry<ProxiedSession>(
							() => leadfootServer.createSession(environmentType),
							config.environmentRetries
						).then(session => {
							session.executor = executor;
							session.coverageEnabled = config.excludeInstrumentation !== true;
							session.coverageVariable = config.instrumenterOptions.coverageVariable;
							session.serverUrl = config.serverUrl;
							session.serverBasePathLength = config.basePath.length;

							let remote: Remote = <Remote>new Command(session);
							remote.environmentType = new Environment(session.capabilities);
							this.remote = remote;

							return executor.emit('sessionStart', remote);
						});
					},

					after() {
						const remote = this.remote;

						if (remote) {
							const endSession = () => {
								return executor.emit('sessionEnd', remote).then(() => {
									return tunnel.sendJobState(remote.session.sessionId, {
										success: this.numFailedTests === 0 && !this.error
									});
								});
							};

							if (
								config.leaveRemoteOpen === true ||
								(config.leaveRemoteOpen === 'fail' && this.numFailedTests > 0)
							) {
								return endSession();
							}

							// A Command behaves like a Promise for our needs
							return remote.quit().finally(endSession);
						}
					}
				});

				// If functional tests were added to this executor, they will be in the executor's _rootSuite property.
				// The functional tests should be run for each remote session, so add _rootSuite to the session suite.
				if (this._rootSuite) {
					this._rootSuite.name = 'functional tests';
					suite.add(this._rootSuite);
				}

				// If unit tests were added to this executor, add a RemoteSuite to the session suite. The RemoteSuite
				// will run the suites listed in executor.config.suites.
				if (config.suites.length > 0) {
					suite.add(new RemoteSuite({ name: 'unit tests' }));
				}

				return suite;
			});
		});
	}

	protected _processOption(name: keyof Config, value: any) {
		switch (name) {
			case 'serverUrl':
				this.config[name] = parseValue(name, value, 'string');
				break;

			case 'capabilities':
			case 'tunnelOptions':
				this.config[name] = parseValue(name, value, 'object');
				break;

			// Must be a string, object, or array of (string | object)
			case 'environments':
				if (typeof value === 'string') {
					try {
						value = parseValue(name, value, 'object');
					}
					catch (error) {
						value = { browserName: value };
					}
				}

				if (!Array.isArray(value)) {
					value = [value];
				}

				this.config[name] = value.map((val: any) => {
					if (typeof val === 'string') {
						try {
							val = parseValue(name, val, 'object');
						}
						catch (error) {
							val = { browserName: val };
						}
					}
					if (typeof val !== 'object') {
						throw new Error(`Invalid value "${value}" for ${name}; must (string | object)[]`);
					}
					// Do some very basic normalization
					if (val.browser && !val.browserName) {
						val.browserName = val.browser;
					}
					return val;
				});
				break;

			case 'tunnel':
				if (typeof value !== 'string' && typeof value !== 'function') {
					throw new Error(`Invalid value "${value}" for ${name}`);
				}
				this.config[name] = value;
				break;

			case 'leaveRemoteOpen':
			case 'serveOnly':
			case 'runInSync':
				this.config[name] = parseValue(name, value, 'boolean');
				break;

			case 'functionalSuites':
				this.config[name] = parseValue(name, value, 'string[]');
				break;

			case 'contactTimeout':
			case 'maxConcurrency':
			case 'environmentRetries':
			case 'serverPort':
			case 'socketPort':
				this.config[name] = parseValue(name, value, 'number');
				break;

			default:
				super._processOption(name, value);
		}
	}

	/**
	 * Override Executor#_loadSuites to pass config.functionalSuites as config.suites to the loader.
	 */
	protected _loadSuites() {
		const config = deepMixin({}, this.config, { suites: this.config.functionalSuites });
		return super._loadSuites(config);
	}

	protected _resolveConfig() {
		const config = this.config;

		return super._resolveConfig().then(() => {
			if (!config.serverPort) {
				config.serverPort = 9000;
			}

			if (!config.socketPort) {
				config.socketPort = config.serverPort + 1;
			}

			if (!config.serverUrl) {
				config.serverUrl = 'http://localhost:' + config.serverPort;
			}

			config.serverUrl = config.serverUrl.replace(/\/*$/, '/');

			if (config.functionalSuites == null) {
				config.functionalSuites = [];
			}

			if (!config.capabilities.name) {
				config.capabilities.name = 'intern';
			}

			const buildId = process.env.TRAVIS_COMMIT || process.env.BUILD_TAG;
			if (buildId) {
				config.capabilities.build = buildId;
			}

			return expandFiles(config.functionalSuites).then(expanded => {
					config.functionalSuites = expanded;
			}).then(() => null);
		});
	}

	/**
	 * Runs each of the root suites, limited to a certain number of suites at the same time by `maxConcurrency`.
	 */
	protected _runTests(): Task<any> {
		const rootSuites = this._rootSuites;
		const queue = new FunctionQueue(this.config.maxConcurrency || Infinity);
		const numSuitesToRun = rootSuites.length;
		let numSuitesCompleted = 0;

		return Task.all(rootSuites.map(suite => {
			return queue.enqueue(() => {
				return suite.run().finally(() => {
					numSuitesCompleted++;
					if (numSuitesCompleted === numSuitesToRun) {
						// All suites have finished running, so emit coverage
						return this._emitCoverage();
					}
				});
			});
		}));
	}
}

export interface Config extends BaseConfig {
	capabilities?: {
		name?: string;
		build?: string;
		[key: string]: any;
	};

	/** Time to wait for contact from a remote server */
	contactTimeout?: number;

	/** A list of remote environments */
	environments: { browserName: string, [key: string]: any }[];

	environmentRetries?: number;
	leaveRemoteOpen?: boolean | 'fail';
	maxConcurrency?: number;
	serveOnly?: boolean;
	serverPort?: number;
	serverUrl?: string;
	runInSync?: boolean;
	socketPort?: number;
	tunnel?: string;
	tunnelOptions?: TunnelOptions | BrowserStackOptions | SeleniumOptions;

	/** A list of unit test suites that will be run in remote browsers */
	suites?: string[];
}

export interface Remote extends Command<any> {
	environmentType?: Environment;
	setHeartbeatInterval(delay: number): Command<any>;
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

	/** A remote session has been opened */
	sessionStart: Remote;

	/** A remote session has ended */
	sessionEnd: Remote;

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
	queue: any[];
	activeTasks: Task<any>[];
	funcTasks: Task<any>[];

	constructor(maxConcurrency: number) {
		this.maxConcurrency = maxConcurrency;
		this.queue = [];
		this.activeTasks = [];
		this.funcTasks = [];
	}

	enqueue(func: () => Task<any>) {
		let resolver: (value?: any) => void;
		let rejecter: (error?: Error) => void;

		const funcTask = new Task((resolve, reject) => {
			resolver = resolve;
			rejecter = reject;
		});
		this.funcTasks.push(funcTask);

		this.queue.push({ func, resolver, rejecter });
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
			const { func, resolver, rejecter } = this.queue.shift();
			const task = func().then(resolver, rejecter).finally(() => {
				// Remove the task from the active task list and kick off the next task
				pullFromArray(this.activeTasks, task);
				this.next();
			});
			this.activeTasks.push(task);
		}
	}
}
