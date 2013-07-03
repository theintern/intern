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
				heartbeat,
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
							clearInterval(heartbeat);
							dfd.resolve();
						}
					})
				];

			// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
			// Selenium commands are issued after this initial call to remote.get() below, so Sauce Labs will assume
			// failure if unit tests take longer than the specified "idle-timeout" Sauce capabilities parameter. Issue
			// a keep-alive heartbeat to assure that the session stays active and that Sauce Labs knows this information.
			// For more info on Sauce timeouts, see https://saucelabs.com/docs/additional-config.
			heartbeat = setInterval(function () {
				remote._wd.url();
			}, config.capabilities['idle-timeout'] * 1000 || 90000);

			remote.get(config.proxyUrl + '__intern/client.html?' + ioQuery.objectToQuery(options)).otherwise(clearHandles);

			return dfd.promise;
		}
	});

	return ClientSuite;
});