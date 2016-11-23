import { ClientSuite } from '../ClientSuite';
import { PreExecutor } from './PreExecutor';
import { Config, Remote } from '../../interfaces';
import { EnvironmentType } from '../EnvironmentType';
import { Executor } from './Executor';
import { ProxiedSession } from '../ProxiedSession';
import { Proxy } from '../Proxy';
import { Suite } from '../Suite';
import * as util from '../util';
import { resolveEnvironments } from '../resolveEnvironments';
import { IRequire } from 'dojo/loader';

// AMD modules
import * as lang from 'dojo/lang';
import * as Promise from 'dojo/Promise';

// Legacy imports
import Server = require('leadfoot/Server');
import Command = require('leadfoot/Command');
import Tunnel = require('digdug/Tunnel');

declare const require: IRequire;

/**
 * The Runner executor is used to run unit & functional tests in remote environments loaded through a WebDriver
 * conduit.
 */
class Runner extends Executor {
	mode: 'runner';

	proxy: Proxy;

	tunnel: Tunnel;

	constructor(config: Config, preExecutor: PreExecutor) {
		super(config, preExecutor)

		this.config = lang.deepDelegate(this.config, {
			capabilities: {
				'idle-timeout': 60
			},
			environmentRetries: 3,
			environments: [],
			maxConcurrency: Infinity,
			reporters: [ 'Runner' ],
			runnerClientReporter: {
				id: 'WebDriver'
			},
			tunnel: 'NullTunnel',
			tunnelOptions: {
				tunnelId: String(Date.now())
			}
		});

		this._fixConfig();
	}

	run() {
		// If we're only runnning the proxy, we want to stop after kicking off the proxy
		if (this.config.proxyOnly) {
			return this._beforeRun();
		}

		return super.run();
	}

	protected _afterRun() {
		const self = this;

		function stopProxy() {
			// `proxy` will not be set if `createAndStartProxy` call fails
			if (self.proxy) {
				return self.proxy.stop().then(function () {
					return self.reporterManager.emit('proxyEnd', self.proxy);
				});
			}
		}

		function stopTunnel() {
			if (self.tunnel && self.tunnel.isRunning) {
				return self.tunnel.stop().then(function () {
					return self.reporterManager.emit('tunnelEnd', self.tunnel);
				});
			}
		}

		return super._afterRun()
			.finally<any>(function () {
				return Promise.all([
					stopProxy(),
					stopTunnel()
				])
				// We do not want to actually return an array of values, so chain a callback that resolves to
				// undefined
				.then(function () {});
			})
			.finally<any>(() => {
				this.reporterManager.empty();
			});
	}

	protected _beforeRun() {
		const self = this;
		const config = this.config;
		const reporterManager = this.reporterManager;

		function createAndStartProxy() {
			var proxy = self._createProxy(config);
			return proxy.start().then(function () {
				self.proxy = proxy;
				return reporterManager.emit('proxyStart', proxy);
			});
		}

		function loadTunnel() {
			return self._loadTunnel(config).then(function (tunnel) {
				self.tunnel = tunnel;
			});
		}

		function loadTestModules() {
			return self._createSuites(config, self.tunnel, self.preExecutor.getArguments()).then(function (suites) {
				self.suites = suites;
				return self._loadTestModules(config.functionalSuites);
			});
		}

		function startTunnel() {
			var tunnel = self.tunnel;
			return tunnel.start().then(function () {
				return reporterManager.emit('tunnelStart', tunnel);
			});
		}

		const promise = super._beforeRun().then(createAndStartProxy);

		if (config.proxyOnly) {
			return promise.then(function () {
				return Promise.resolve(config.setup && config.setup.call(config, self))
					.then(function () {
						// Pause indefinitely until canceled
						return new Promise(function () {});
					})
					.finally<any>(function () {
						return Promise.resolve(config.teardown && config.teardown.call(config, self));
					})
					.finally<any>(function () {
						return self.proxy && self.proxy.stop();
					});
			});
		}

		return promise
			.then(loadTunnel)
			.then(loadTestModules)
			.then(startTunnel);
	}

	/**
	 * Creates suites for each environment in which tests will be executed.
	 *
	 * @param config Intern configuration.
	 * @param tunnel A Dig Dug tunnel.
	 * @param overrides Overrides to the user configuration provided via command-line.
	 * @returns An array of root suites.
	 */
	protected _createSuites(config: Config, tunnel: Tunnel, overrides: { [key: string]: string }) {
		const proxy = this.proxy;
		const reporterManager = this.reporterManager;
		const server = new Server(tunnel.clientUrl, {
			proxy: tunnel.proxy
		});
		server.sessionConstructor = ProxiedSession;

		return tunnel.getEnvironments().then(function (tunnelEnvironments) {
			return resolveEnvironments(
				config.capabilities,
				config.environments,
				tunnelEnvironments
			).map(function (environmentType) {
				var suite = new Suite({
					name: String(environmentType),
					reporterManager: reporterManager,
					publishAfterSetup: true,
					grep: config.grep,
					bail: config.bail,
					timeout: config.defaultTimeout,

					setup: function () {
						return util.retry(function () {
							return server.createSession(environmentType);
						}, config.environmentRetries).then(function (session: ProxiedSession) {
							session.coverageEnabled = config.excludeInstrumentation !== true;
							session.coverageVariable = config.instrumenterOptions.coverageVariable;
							session.proxyUrl = config.proxyUrl;
							session.proxyBasePathLength = config.basePath.length;
							session.reporterManager = reporterManager;

							let command: Remote = <Remote> new Command(session);
							command.environmentType = new EnvironmentType(session.capabilities);

							suite.remote = command;
							// TODO: Document or remove sessionStart/sessionEnd.
							return reporterManager.emit('sessionStart', command);
						});
					},

					teardown: function (this: Suite): Promise<any> {
						const remote = this.remote;

						function endSession() {
							return reporterManager.emit('sessionEnd', remote).then(function () {
								return tunnel.sendJobState(remote.session.sessionId, {
									success: suite.numFailedTests === 0 && !suite.error
								});
							});
						}

						if (remote) {
							if (
								config.leaveRemoteOpen === true ||
								(config.leaveRemoteOpen === 'fail' && this.numFailedTests > 0)
							) {
								return endSession();
							}

							// A Command behaves like a Promise for our needs
							return <any> remote.quit().finally(endSession);
						}
					}
				});

				// The `suites` flag specified on the command-line as an empty string will just get converted to an
				// empty array in the client, which means we can skip the client tests entirely. Otherwise, if no
				// suites were specified on the command-line, we rely on the existence of `config.suites` to decide
				// whether or not to client suites. If `config.suites` is truthy, it may be an empty array on the
				// Node.js side but could be a populated array when it gets to the browser side (conditional based
				// on environment), so we require users to explicitly set it to a falsy value to assure the test
				// system that it should not run the client
				if (config.suites) {
					suite.tests.push(new ClientSuite({
						args: overrides,
						config: config,
						parent: suite,
						proxy: proxy
					}));
				}

				return suite;
			});
		});
	}

	/**
	 * Creates an instrumenting proxy for sending instrumented code to the remote environment and receiving
	 * data back from the remote environment.
	 *
	 * @param config The Intern configuration object.
	 * @returns A proxy.
	 */
	protected _createProxy(config: Config) {
		return new Proxy({
			basePath: config.basePath,
			instrumenterOptions: config.instrumenterOptions,
			excludeInstrumentation: config.excludeInstrumentation,
			instrument: true,
			waitForRunner: config.runnerClientReporter.waitForRunner,
			port: config.proxyPort
		});
	}

	/**
	 * Fixes up the configuration object with extra information specific to this executor.
	 */
	protected _fixConfig() {
		/* jshint node:true */
		var config = this.config;

		if (!config.capabilities.name) {
			config.capabilities.name = config.config;
		}

		var buildId = process.env.TRAVIS_COMMIT || process.env.BUILD_TAG;
		if (buildId) {
			config.capabilities.build = buildId;
		}

		config.proxyUrl = config.proxyUrl.replace(/\/*$/, '/');

		if (config.tunnel.indexOf('/') === -1) {
			config.tunnel = 'dojo/node!digdug/' + config.tunnel;
		}

		config.tunnelOptions.servers = (config.tunnelOptions.servers || []).concat(config.proxyUrl);
	}

	/**
	 * Loads a Dig Dug tunnel.
	 *
	 * @param config The Intern configuration object.
	 * @returns {module:digdug/Tunnel} A Dig Dug tunnel.
	 */
	protected _loadTunnel(config: Config) {
		var reporterManager = this.reporterManager;
		return util.getModule(config.tunnel, <IRequire> require).then(function (Tunnel) {
			// Tunnel only copies own property values from the config object, so make a flat
			// copy of config.tunnelOptions (it's a delegate)
			var tunnelOptions = lang.deepMixin({}, config.tunnelOptions);
			var tunnel = new Tunnel(tunnelOptions);

			tunnel.on('downloadprogress', function (progress: any) {
				reporterManager.emit('tunnelDownloadProgress', tunnel, progress);
			});
			tunnel.on('status', function (status: any) {
				reporterManager.emit('tunnelStatus', tunnel, status);
			});

			config.capabilities = lang.deepMixin(tunnel.extraCapabilities, config.capabilities);

			return tunnel;
		});
	}

	protected _startTunnel() {
		const self = this;
		const config = this.config;

		function createAndStartProxy() {
			var proxy = self._createProxy(config);
			return proxy.start().then(function () {
				self.proxy = proxy;
				return self.reporterManager.emit('proxyStart', proxy);
			});
		}

		function loadTunnel() {
			return self._loadTunnel(config).then(function (tunnel) {
				self.tunnel = tunnel;
			});
		}

		function loadTestModules() {
			return self._createSuites(config, self.tunnel, self.preExecutor.getArguments()).then(function (suites) {
				self.suites = suites;
				return self._loadTestModules(config.functionalSuites);
			});
		}

		function startTunnel() {
			var tunnel = self.tunnel;
			return tunnel.start().then(function () {
				return self.reporterManager.emit('tunnelStart', tunnel);
			});
		}

		var promise = super._beforeRun().then(createAndStartProxy);

		if (config.proxyOnly) {
			return promise.then(function () {
				return Promise.resolve(self.config.setup && self.config.setup(self))
					.then(function () {
						// TODO: This seems redundant
						return new Promise(function () {});
					})
					.finally(function () {
						return Promise.resolve(self.config.teardown && self.config.teardown(self));
					})
					.finally(function () {
						return self.proxy && self.proxy.stop();
					});
			});
		}
	}
}
