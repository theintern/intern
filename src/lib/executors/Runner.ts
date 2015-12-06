import { deepDelegate, deepMixin } from 'dojo/lang';
import Promise = require('dojo/Promise');
import Server = require('leadfoot/Server');
import Command = require('leadfoot/Command');
import ClientSuite from '../ClientSuite';
import Proxy from '../Proxy';
import EnvironmentType from '../EnvironmentType';
import Executor from './Executor';
import { default as ProxiedSession, Command as ProxiedCommand } from '../ProxiedSession';
import Suite from '../Suite';
import * as util from '../util';
import { AmdRequire } from '../util';
import { default as PreExecutor, InternConfig } from './PreExecutor';
import Tunnel = require('digdug/Tunnel');

declare var require: AmdRequire;

export default class Runner extends Executor {
	config: InternConfig = deepDelegate(this.config, {
		capabilities: {
			'idle-timeout': 60
		},
		environmentRetries: 3,
		environments: [],
		maxConcurrency: Infinity,
		proxyPort: 9000,
		proxyUrl: 'http://localhost:9000/',
		reporters: [ { id: 'Runner' } ],
		runnerClientReporter: {
			id: 'WebDriver'
		},
		tunnel: 'NullTunnel',
		tunnelOptions: {
			tunnelId: String(Date.now())
		}
	});

	mode = 'runner';

	proxy: Proxy;

	tunnel: Tunnel;

	constructor(config: InternConfig, preExecutor: PreExecutor) {
		super(config, preExecutor);
		this._fixConfig();
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

		function unloadReporters() {
			self.reporterManager.empty();
		}

		return super._afterRun.apply(this, arguments)
			.finally(function () {
				return Promise.all([
					stopProxy(),
					stopTunnel()
				])
				// We do not want to actually return an array of values, so chain a callback that resolves to
				// undefined
				.then(function () {});
			})
			.finally(unloadReporters);
	}

	protected _beforeRun() {
		const self = this;
		const config = this.config;

		function createAndStartProxy() {
			const proxy = self._createProxy(config);
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
			self.suites = self._createSuites(config, self.tunnel, self.preExecutor.getArguments());
			return self._loadTestModules(config.functionalSuites);
		}

		function startTunnel() {
			const tunnel = self.tunnel;
			return tunnel.start().then(function () {
				return self.reporterManager.emit('tunnelStart', tunnel);
			});
		}

		const promise = super._beforeRun.apply(this, arguments)
			.then(createAndStartProxy);

		if (config.proxyOnly) {
			return promise.then(function () {
				function runConfigSetup() {
					return Promise.resolve(self.config.setup && self.config.setup(self));
				}

				function runConfigTeardown() {
					return Promise.resolve(self.config.teardown && self.config.teardown(self));
				}

				return runConfigSetup().then(function () {
					return new Promise(function () {});
				})
				.finally(runConfigTeardown)
				.finally(function () {
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
	 * @param {Configuration} config Intern configuration.
	 * @param {module:digdug/Tunnel} tunnel A Dig Dug tunnel.
	 * @param {Object} overrides Overrides to the user configuration provided via command-line.
	 * @returns {Suite[]} An array of root suites.
	 */
	protected _createSuites(config: InternConfig, tunnel: Tunnel, overrides: { [key: string]: any; }) {
		const proxy = this.proxy;
		const reporterManager = this.reporterManager;
		const server = new Server(tunnel.clientUrl, {
			proxy: tunnel.proxy
		});
		server.sessionConstructor = ProxiedSession;

		return util.flattenEnvironments(config.capabilities, config.environments).map(function (environmentType) {
			const suite = new Suite({
				name: String(environmentType),
				reporterManager: reporterManager,
				publishAfterSetup: true,
				grep: config.grep,
				timeout: config.defaultTimeout,
				setup: function () {
					return util.retry(function () {
						return server.createSession(environmentType);
					}, config.environmentRetries).then(function (session: ProxiedSession) {
						session.coverageEnabled = config.excludeInstrumentation !== true;
						session.coverageVariable = config.coverageVariable;
						session.proxyUrl = config.proxyUrl;
						session.proxyBasePathLength = config.basePath.length;
						session.reporterManager = reporterManager;

						const command = <ProxiedCommand<void>> new Command<void>(session);
						command.environmentType = new EnvironmentType(session.capabilities);

						suite.remote = command;
						// TODO: Document or remove sessionStart/sessionEnd.
						return reporterManager.emit('sessionStart', command);
					});
				},
				teardown: function () {
					const remote = this.remote;

					function endSession(): Promise<void> {
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

						return remote.quit().finally(endSession);
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
	}

	/**
	 * Creates an instrumenting proxy for sending instrumented code to the remote environment and receiving
	 * data back from the remote environment.
	 *
	 * @param {Configuration} config The Intern configuration object.
	 * @returns {Proxy} A proxy.
	 */
	protected _createProxy(config: InternConfig) {
		return new Proxy({
			basePath: config.basePath,
			coverageVariable: config.coverageVariable,
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
		const config = this.config;

		if (!config.capabilities.name) {
			config.capabilities.name = config.config;
		}

		const buildId = process.env.TRAVIS_COMMIT || process.env.BUILD_TAG;
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
	 * @returns A Dig Dug tunnel.
	 */
	protected _loadTunnel(config: InternConfig) {
		const reporterManager = this.reporterManager;
		return util.getModule<typeof Tunnel>(config.tunnel, require).then(function (Tunnel) {
			// Tunnel only copies own property values from the config object, so make a flat
			// copy of config.tunnelOptions (it's a delegate)
			const tunnelOptions = deepMixin({}, config.tunnelOptions);
			const tunnel = new Tunnel(tunnelOptions);

			tunnel.on('downloadprogress', function (progress) {
				reporterManager.emit('tunnelDownloadProgress', tunnel, progress);
			});
			tunnel.on('status', function (status) {
				reporterManager.emit('tunnelStatus', tunnel, status);
			});

			config.capabilities = deepMixin(tunnel.extraCapabilities, config.capabilities);

			return tunnel;
		});
	}

	run() {
		if (this.config.proxyOnly) {
			return this._beforeRun();
		}

		return super.run.apply(this, arguments);
	}
}
