import Suite, { SuiteOptions } from './Suite';
import UrlSearchParams from '@dojo/core/UrlSearchParams';
import { Handle, Hash } from '@dojo/interfaces/core';
import { parse } from 'url';
import Task from '@dojo/core/async/Task';
import { InternError } from './types';
import Node, { Events } from './executors/Node';
import { Config as BrowserConfig } from './executors/Browser';
import { stringify } from './common/util';
import Deferred from './Deferred';

/**
 * RemoteSuite is a class that acts as a local server for one or more unit test suites being run in a remote browser.
 */
export default class RemoteSuite extends Suite {
	executor: Node;

	constructor(options?: Partial<SuiteOptions>) {
		options = options || {};
		if (options.name == null) {
			options.name = 'remote unit tests';
		}

		super(<SuiteOptions>options);

		if (this.timeout == null) {
			this.timeout = Infinity;
		}
	}

	/**
	 * Override Suite#id to exclude the RemoteSuite's name from the generated ID since the RemoteSuite is just a proxy
	 * for a remote suite.
	 */
	get id() {
		let name: string[] = [];
		let suite: Suite = this.parent;

		do {
			suite.name != null && name.unshift(suite.name);
		} while ((suite = suite.parent));

		return name.join(' - ');
	}

	/**
	 * Run a suite in a remote browser.
	 */
	run(): Task<any> {
		const remote = this.remote;
		const sessionId = remote.session.sessionId;
		const server = this.executor.server;
		let listenerHandle: Handle;
		let connectTimer: NodeJS.Timer;

		return new Task(
			(resolve, reject) => {
				const handleError = (error: InternError) => {
					this.error = error;
					reject(error);
				};

				// This is a deferred that will resolve when the remote sends back a 'remoteConfigured' message
				const pendingConnection = new Deferred<void>();

				// If the remote takes to long to connect, reject the connection promise
				connectTimer = setTimeout(() => {
					const error = new Error('Timed out waiting for remote to connect');
					error.name = 'TimeoutError';
					pendingConnection.reject(error);
				}, this.executor.config.connectTimeout);

				// Subscribe to messages received by the server for a particular remote session ID.
				listenerHandle = server.subscribe(sessionId, (name: keyof RemoteEvents, data: any) => {
					let suite: Suite;

					switch (name) {
						case 'remoteStatus':
							if (data === 'initialized') {
								clearTimeout(connectTimer);
								pendingConnection.resolve();
							}
							break;

						case 'suiteStart':
							suite = data;
							if (!suite.hasParent) {
								// This suite from the browser is a root suite; add its tests to the local suite
								this.tests.push(...suite.tests);

								// Tell the executor that the local suite has started
								return this.executor.emit('suiteStart', this);
							}
							else {
								// If suite from the browser isn't a root (i.e., it's a nested suite), just forward the
								// start event
								return this.executor.emit(name, data);
							}

						case 'suiteEnd':
							suite = data;
							this.skipped = suite.skipped;

							if (!suite.hasParent) {
								// When the remote root suite has finished, replace the local test objects with the
								// incoming test data since it will include final results.
								suite.tests.forEach((test, index) => {
									this.tests[index] = test;
								});

								if (suite.error) {
									handleError(suite.error);
								}
							}
							else {
								// If suite from the browser isn't a root, just forward the end event
								return this.executor.emit(name, data);
							}
							break;

						case 'beforeRun':
						case 'afterRun':
						case 'runStart':
							// Consume these events -- they shouldn't be forwarded to any local listeners
							break;

						case 'runEnd':
							// Consume this event, and do some post-processing
							let promise = remote.setHeartbeatInterval(0);
							if (config.excludeInstrumentation !== true) {
								// get about:blank to always collect code coverage data from the page in case it is
								// navigated away later by some other process; this happens during self-testing when the
								// Leadfoot library takes over
								promise = promise.get('about:blank');
							}
							return promise.then(resolve, reject);

						case 'error':
							// Ignore summary suite error messages
							if (!(/One or more suite errors/).test(data.message)) {
								handleError(data);
							}
							break;

						default:
							return this.executor.emit(name, data);
					}
				});

				const config = this.executor.config;
				const serverUrl = parse(config.serverUrl);

				// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
				// real commands are issued after the call to remote.get() below until all unit tests are complete, so
				// we need to make sure that we periodically send no-ops through the channel to ensure the remote server
				// does not treat the session as having timed out
				const timeout = config.capabilities['idle-timeout'];
				if (timeout >= 1 && timeout < Infinity) {
					remote.setHeartbeatInterval((timeout - 1) * 1000);
				}

				// These are options that will be passed as query params to the test harness page
				const queryOptions: Partial<RemoteConfig> = {
					basePath: serverUrl.pathname,
					serverUrl: serverUrl.href,
					sessionId: sessionId,
					socketPort: server.socketPort
				};

				// Do some pre-serialization of the options
				const queryParams: Hash<any> = {};
				Object.keys(queryOptions).filter((key: keyof RemoteConfig) => {
					return queryOptions[key] != null;
				}).forEach((key: keyof RemoteConfig) => {
					let value = queryOptions[key];
					if (typeof value === 'object') {
						value = JSON.stringify(value);
					}
					queryParams[key] = value;
				});

				const query = new UrlSearchParams(queryParams);
				const harness = `${config.serverUrl}__intern/browser/remote.html`;

				// These are options that will be POSTed to the remote page and used to configure intern. Stringify and
				// parse them to ensure that the config can be properly transmitted.
				const remoteConfig: Partial<RemoteConfig> = {
					debug: config.debug,
					internPath: `${serverUrl.pathname}${config.internPath}`,
					name: this.id,
					reporters: [ { name: 'dom' } ]
				};

				// Don't overwrite any config data we've already set
				const excludeKeys: { [key: string]: boolean } = {
					basePath: true,
					internPath: true,
					name: true,
					reporters: true,
					serverUrl: true,
					sessionId: true,
					socketPort: true
				};

				// Pass all non-excluded keys to the remote config
				Object.keys(config).filter(key => !excludeKeys[key]).forEach((key: keyof RemoteConfig) => {
					remoteConfig[key] = config[key];
				});

				this.executor.log('Configuring remote "', this.name, '" with', remoteConfig);

				remote
					.get(`${harness}?${query}`)
					.then(() => pendingConnection.promise)
					// Send the config data in an execute block to avoid sending very large query strings
					.execute(/* istanbul ignore next */function (configString: string) {
						const options = JSON.parse(configString);
						intern.configure(options);
						intern.run().catch(_error => { });
					}, [stringify(remoteConfig)])
					// If there's an error loading the page, kill the heartbeat and fail
					.catch(error => remote.setHeartbeatInterval(0).finally(() => handleError(error)));
			},
			// Canceller
			() => remote.setHeartbeatInterval(0)
		)
		.catch(error => {
			if (!this.error) {
				this.error = error;
			}
			throw error;
		})
		.finally(() => {
			if (connectTimer) {
				clearTimeout(connectTimer);
			}
			listenerHandle.destroy();
		})
		.finally(() => this.executor.emit('suiteEnd', this));
	}
}

export interface RemoteEvents extends Events {
	remoteStatus: string;
}

export interface RemoteConfig extends BrowserConfig {
	serverUrl: string;
	sessionId: string;
	runInSync?: boolean;
	socketPort?: number;
}
