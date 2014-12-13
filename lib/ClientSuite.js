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

		// TODO: Change this from using sessionId to identifying the suite in the root suites array by index
		run: function () {
			function handleError(error) {
				self.error = error;
				self.reporterManager.emit('suiteError', self);
				dfd.reject(error);
			}

			var args = this.args;
			var config = this.config;
			var remote = this.remote;
			var options = lang.mixin({}, args, {
				// the proxy always serves the baseUrl from the loader configuration as the root of the proxy,
				// so ensure that baseUrl is always set to that root on the client
				baseUrl: urlUtil.parse(config.proxyUrl).pathname,
				reporters: 'WebDriver',
				sessionId: remote.session.sessionId
			});
			var self = this;
			var dfd = new Promise.Deferred();

			function ClientReporter() {
				this.suiteEnd = function (suite) {
					if (suite.sessionId === remote.session.sessionId && !suite.hasParent) {
						self.tests.push(suite);
					}
				};

				// `remote.get` does not resolve as early as it should. this means it might be too late to pick up
				// errors if we do not start listening for the clientEnd event until after `remote.get`
				// executes successfully
				this.clientEnd = function (sessionId) {
					if (sessionId === remote.session.sessionId) {
						handle.remove();
						// get about:blank to always collect code coverage data from the page in case it is
						// navigated away later by some other process; this happens during self-testing when
						// the new Leadfoot library takes over
						return remote.setHeartbeatInterval(0).get('about:blank').then(function () {
							dfd.resolve();
						}, handleError);
					}
				};
			}

			var handle = this.reporterManager.add(ClientReporter, {});

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
