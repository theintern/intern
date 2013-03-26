define([
	'dojo-ts/lang',
	'dojo-ts/io-query',
	'dojo-ts/Deferred',
	'dojo-ts/topic',
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
							dfd.resolve();
						}
					})
				];

			remote.get(config.proxyUrl + '__teststack/client.html?' + ioQuery.objectToQuery(options)).otherwise(clearHandles);

			return dfd.promise;
		}
	});

	return ClientSuite;
});