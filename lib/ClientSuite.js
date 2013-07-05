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
					config: args.config,
					sessionId: remote.sessionId,
					reporters: 'webdriver'
				},
				self = this,
				dfd = new Deferred(),
				handles = [
					topic.subscribe('/suite/end', function (suite) {
						if (suite.sessionId === remote.sessionId && !suite.parent) {
							self.tests.push(suite);
						}
					}),

					// `remote.get` does not resolve as early as it should. this means it might be too late to pick up
					// errors if we do not start listening for the `/client/end` topic until after `remote.get`
					// executes successfully
					topic.subscribe('/client/end', function (sessionId) {
						if (sessionId === remote.sessionId) {
							clearHandles();
							// Passing a delay of 0 clears the current interval and won't create a new one
							remote.setHeartbeatInterval(0);
							dfd.resolve();
						}
					})
				];

			// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
			// Selenium commands are issued after this initial call to remote.get() below, so Sauce Labs will assume
			// failure if unit tests take longer than the specified "idle-timeout" Sauce capabilities parameter. 
			// wd.setHeartbeatInterval() creates an interval that issues a keep-alive Selenium command to ensure that 
			// Sauce Labs knows the session is still active. For more info see https://saucelabs.com/docs/additional-config.
			remote.setHeartbeatInterval(config.capabilities['idle-timeout'] * 1000);

			remote.get(config.proxyUrl + '__intern/client.html?' + ioQuery.objectToQuery(options)).otherwise(clearHandles);

			return dfd.promise;
		}
	});

	return ClientSuite;
});