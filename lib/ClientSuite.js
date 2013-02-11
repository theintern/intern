define([
	'dojo-ts/lang',
	'dojo-ts/io-query',
	'dojo-ts/Deferred',
	'dojo-ts/topic',
	'./Suite'
], function (lang, ioQuery, Deferred, topic, Suite) {
	function ClientSuite() {
		this.config = {};

		Suite.apply(this, arguments);
	}

	ClientSuite.prototype = lang.mixin(new Suite(), {
		constructor: ClientSuite,
		name: 'unit tests',
		// TODO: Seems timeouts are busted~
		timeout: 10 * 60 * 1000,
		config: null,
		run: function () {
			var config = this.config,
				remote = this.remote,
				options = {
					sessionId: remote.sessionId,
					reporter: 'webdriver',
					suites: config.suites
				},
				self = this,
				handles = [];

			if (config.packages) {
				options.packages = JSON.stringify(config.packages);
			}

			handles.push(topic.subscribe('/suite/end', function (suite) {
				if (suite.sessionId === remote.sessionId && !suite.hasParent) {
					self.tests.push(suite);
				}
			}));

			var dfd = new Deferred();

			remote.get(config.clientHtmlLocation + '?' + ioQuery.objectToQuery(options)).then(function waitForSuiteToFinish() {
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

	return ClientSuite;
});