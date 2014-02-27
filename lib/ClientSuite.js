define([
	'dojo/lang',
	'dojo/io-query',
	'dojo/Deferred',
	'dojo/topic',
	'./args',
	'./Suite'
], function (lang, ioQuery, Deferred, topic, args, Suite) {
	function ClientSuite() {
		this.config = {};

		Suite.apply(this, arguments);
	}

	ClientSuite.prototype = lang.mixin(new Suite(), {
		constructor: ClientSuite,
		name: 'unit tests',
		// TODO: Timeouts are not working?
		timeout: 10 * 60 * 1000,
		config: null,

		run: function () {
			function clearHandles() {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
			}

			var config = this.config,
				remote = this.remote,
				options = {
					// the proxy always serves the baseUrl from the loader configuration as the root of the proxy,
					// so ensure that baseUrl is always set to that root on the client
					baseUrl: '/',
					reporters: 'webdriver',
					sessionId: remote.sessionId
				},
				self = this,
				dfd = new Deferred(),
				handles = [
					topic.subscribe('/suite/end', function (suite) {
						if (suite.sessionId === remote.sessionId && !suite.hasParent) {
							self.tests.push(suite);
						}
					}),

					// `remote.get` does not resolve as early as it should. this means it might be too late to pick up
					// errors if we do not start listening for the `/client/end` topic until after `remote.get`
					// executes successfully
					topic.subscribe('/client/end', function (sessionId) {
						if (sessionId === remote.sessionId) {
							remote.setHeartbeatInterval(0);
							clearHandles();
							dfd.resolve();
						}
					})
				];

			// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
			// real commands are issued after the call to remote.get() below until all unit tests are complete, so
			// we need to make sure that we periodically send no-ops through the channel to ensure the remote server
			// does not treat the session as having timed out
			var timeout = config.capabilities['idle-timeout'];
			if (timeout >= 1 && timeout < Infinity) {
				remote.setHeartbeatInterval((timeout - 1) * 1000);
			}

			// Remove `reporters` from arguments, reporters is already set to `webdriver`
			delete args.reporters;
			// Combine options with options
			var clientArgs = [ioQuery.objectToQuery(options), ioQuery.objectToQuery(args)].join('&');

			remote
				.get(config.proxyUrl + '__intern/client.html?' + clientArgs)
				.otherwise(clearHandles);

			return dfd.promise;
		}
	});

	return ClientSuite;
});
