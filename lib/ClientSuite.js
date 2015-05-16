define([
	'dojo/lang',
	'dojo/Promise',
	'dojo/node!url',
	'dojo/aspect',
	'dojo/io-query',
	'./Suite'
], function (lang, Promise, urlUtil, aspect, ioQuery, Suite) {
	function ClientSuite() {
		this.config = {};

		Suite.apply(this, arguments);
	}

	var _super = Suite.prototype;
	ClientSuite.prototype = lang.mixin(Object.create(_super), /** @lends module:intern/lib/ClientSuite# */ {
		constructor: ClientSuite,
		name: 'unit tests',
		timeout: Infinity,
		args: null,
		config: null,
		proxy: null,

		// TODO: Change this from using Selenium-provided sessionId to self-generated constant identifier so that
		// sessions can be safely reset in the middle of a test run
		run: function () {
			var self = this;
			var reporterManager = this.reporterManager;
			var config = this.config;
			var remote = this.remote;
			var sessionId = remote.session.sessionId;

			var handle = this.proxy.subscribeToSession(sessionId, receiveEvent);
			var dfd = new Promise.Deferred(function (reason) {
				handle.remove();
				return remote.setHeartbeatInterval(0).then(function () {
					throw reason;
				});
			});

			// TODO: Reporters on the server that want to do something need to be able to pause the reporters
			// running in unit tests on the client, but right now this interface is fire-and-forget
			function receiveEvent(name) {
				var args = arguments;
				function forward() {
					reporterManager.emit.apply(reporterManager, args);
				}

				switch (name) {
					case 'suiteEnd':
						var suite = arguments[1];
						// The suite sent by the server is the root suite for the client-side unit tests; add it to all
						// the rest of the tests on the server so everything can be combined and calculated, and the
						// corresponding suiteEnd event will be dispatched when ClientSuite itself finishes
						if (!suite.hasParent) {
							suite.tests.forEach(function (test) {
								self.tests.push(test);
							});
						}
						else {
							forward();
						}
						break;

					// TODO: Transform this to something consumable for reporters
					case 'runStart':
						break;

					// TODO: Transform this to something consumable for reporters
					case 'runEnd':
						handle.remove();
						// get about:blank to always collect code coverage data from the page in case it is
						// navigated away later by some other process; this happens during self-testing when
						// the new Leadfoot library takes over
						remote.setHeartbeatInterval(0).get('about:blank').then(function () {
							dfd.resolve();
						}, handleError);
						break;

					case 'fatalError':
						var error = arguments[1];
						self.error = error;
						dfd.reject(error);
						break;

					default:
						forward();
				}
			}

			function handleError(error) {
				self.error = error;
				return self.reporterManager.emit('suiteError', self).then(function () {
					dfd.reject(error);
				});
			}

			var options = lang.mixin({}, this.args, {
				// the proxy always serves the baseUrl from the loader configuration as the root of the proxy,
				// so ensure that baseUrl is always set to that root on the client
				baseUrl: urlUtil.parse(config.proxyUrl).pathname,
				reporters: 'WebDriver',
				rootSuiteName: self.id,
				sessionId: sessionId
			});

			// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
			// real commands are issued after the call to remote.get() below until all unit tests are complete, so
			// we need to make sure that we periodically send no-ops through the channel to ensure the remote server
			// does not treat the session as having timed out
			var timeout = config.capabilities['idle-timeout'];
			if (timeout >= 1 && timeout < Infinity) {
				remote.setHeartbeatInterval((timeout - 1) * 1000);
			}

			remote
				.get(config.proxyUrl + '__intern/client.html?' + ioQuery.objectToQuery(options))
				.catch(function (error) {
					handle.remove();
					remote.setHeartbeatInterval(0).then(function () {
						handleError(error);
					});
				});

			return dfd.promise;
		}
	});

	return ClientSuite;
});
