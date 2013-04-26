define([
	'dojo/_base/declare',
	'dojo/io-query',
	'dojo/Deferred',
	'dojo/topic',
	'./args',
	'./Suite'
], function (declare, ioQuery, Deferred, topic, args, Suite) {
	return declare(Suite, {
		name: 'unit tests',
		// TODO: Timeouts are not working?
		timeout: 10 * 60 * 1000,
		config: null,

		constructor: function () {
			this.config = {};
		},

		run: function () {
			function clearHandles() {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
			}

			var config = this.config,
				remote = this.get('remote'),
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

			remote.get(config.proxyUrl + '__intern/client.html?' + ioQuery.objectToQuery(options)).otherwise(clearHandles);

			return dfd.promise;
		}
	});
});
