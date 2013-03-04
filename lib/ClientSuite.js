define([
	'dojo-ts/_base/declare',
	'dojo-ts/io-query',
	'dojo-ts/Deferred',
	'dojo-ts/topic',
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
			var config = this.config,
				remote = this.get('remote'),
				options = {
					config: args.config,
					sessionId: remote.sessionId,
					reporter: 'webdriver'
				},
				self = this,
				handles = [];

			handles.push(topic.subscribe('/suite/end', function (suite) {
				if (suite.get('sessionId') === remote.sessionId && !suite.hasParent) {
					self.tests.push(suite);
				}
			}));

			var dfd = new Deferred();

			remote.get(config.proxyUrl + '__teststack/client.html?' + ioQuery.objectToQuery(options)).then(function waitForSuiteToFinish() {
				// TODO: And if it doesn't finish..?
				handles.push(topic.subscribe('/client/end', function (sessionId) {
					if (sessionId === remote.sessionId) {
						handles.forEach(function (handle) {
							handle.remove();
						});

						dfd.resolve();
					}
				}));
			});

			return dfd.promise;
		}
	});
});
