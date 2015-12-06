import { mixin } from 'dojo/lang';
import Promise = require('dojo/Promise');
import { objectToQuery } from 'dojo/io-query';
import { default as Suite, KwArgs as SuiteKwArgs } from './Suite';
import pathUtil = require('path');
import urlUtil = require('url');
import Proxy from './Proxy';
import { InternConfig } from './executors/PreExecutor';

type MaybePromise = void | Promise.Thenable<void>;

export interface KwArgs extends SuiteKwArgs {
	args?: { [key: string]: any; };
	config?: InternConfig;
	proxy?: Proxy;
}

export default class ClientSuite extends Suite {
	config: InternConfig = {};

	args: { [key: string]: any; };
	proxy: Proxy;

	constructor(kwArgs: KwArgs) {
		super(kwArgs);
		this.name = 'unit tests';
		this.timeout = Infinity;
	}

	// TODO: Change this from using Selenium-provided sessionId to self-generated constant identifier so that
	// sessions can be safely reset in the middle of a test run
	run() {
		const self = this;
		const reporterManager = this.reporterManager;
		const config = this.config;
		const remote = this.remote;
		const sessionId = remote.session.sessionId;

		const handle = this.proxy.subscribeToSession(sessionId, receiveEvent);
		const dfd = new Promise.Deferred(function (reason) {
			handle.remove();
			return remote.setHeartbeatInterval(0).then(function () {
				throw reason;
			});
		});

		function receiveEvent(name: 'suiteStart', suite: Suite): MaybePromise;
		function receiveEvent(name: 'suiteEnd', suite: Suite): MaybePromise;
		function receiveEvent(name: 'suiteError', suite: Suite, error: Error): MaybePromise;
		function receiveEvent(name: 'runStart'): MaybePromise;
		function receiveEvent(name: 'runEnd'): MaybePromise;
		function receiveEvent(name: 'fatalError', error: Error): MaybePromise;
		function receiveEvent(name: string, ...args: any[]): MaybePromise;
		function receiveEvent(name: string) {
			const args = arguments;
			function forward() {
				return reporterManager.emit.apply(reporterManager, args);
			}

			switch (name) {
				case 'suiteStart': {
					const suite: Suite = arguments[1];
					// The suite sent by the server is the root suite for the client-side unit tests; add its tests
					// to the runner-side client suite
					if (!suite.hasParent) {
						suite.tests.forEach(function (test) {
							self.tests.push(test);
						});
						return reporterManager.emit('suiteStart', self);
					}
					return forward();
				}

				case 'suiteEnd': {
					const suite: Suite = arguments[1];
					// The suite sent by the server is the root suite for the client-side unit tests; update the
					// existing test objects with the new ones from the server that reflect all the test results
					if (!suite.hasParent) {
						suite.tests.forEach(function (test, index) {
							self.tests[index] = test;
						});
					}
					else {
						return forward();
					}
					break;
				}

				case 'suiteError': {
					const suite: Suite = arguments[1];
					if (!suite.hasParent) {
						handle.remove();
						return handleError(arguments[2]);
					}
					return forward();
				}

				case 'runStart': {
					break;
				}

				case 'runEnd': {
					handle.remove();
					// get about:blank to always collect code coverage data from the page in case it is
					// navigated away later by some other process; this happens during self-testing when
					// the new Leadfoot library takes over
					remote.setHeartbeatInterval(0).get('about:blank').then(function () {
						return reporterManager.emit('suiteEnd', self);
					}).then(function () {
						dfd.resolve();
					}, handleError);
					break;
				}

				case 'fatalError': {
					handle.remove();
					const error = arguments[1];
					return handleError(error);
				}

				default: {
					return forward();
				}
			}
		}

		function handleError(error: Error) {
			self.error = error;
			return self.reporterManager.emit('suiteError', self, error).then(function () {
				dfd.reject(error);
			});
		}

		const proxyBasePath = urlUtil.parse(config.proxyUrl).pathname;

		// Need to mixin the properties of `clientReporter` to a new object before stringify because
		// stringify only serialises an object’s own properties
		let clientReporter = mixin({ id: 'WebDriver' }, this.config.runnerClientReporter);

		const options = mixin({}, this.args, {
			// the proxy always serves the baseUrl from the loader configuration as the root of the proxy,
			// so ensure that baseUrl is always set to that root on the client
			basePath: proxyBasePath,
			initialBaseUrl: proxyBasePath + pathUtil.relative(config.basePath, process.cwd()),
			reporters: clientReporter,
			rootSuiteName: self.id,
			sessionId: sessionId
		});

		// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
		// real commands are issued after the call to remote.get() below until all unit tests are complete, so
		// we need to make sure that we periodically send no-ops through the channel to ensure the remote server
		// does not treat the session as having timed out
		const timeout = config.capabilities['idle-timeout'];
		if (timeout >= 1 && timeout < Infinity) {
			remote.setHeartbeatInterval((timeout - 1) * 1000);
		}

		remote
			.get(config.proxyUrl + '__intern/client.html?' + objectToQuery(options))
			.catch(function (error: Error) {
				handle.remove();
				remote.setHeartbeatInterval(0).then(function () {
					handleError(error);
				});
			});

		return dfd.promise;
	}
}
