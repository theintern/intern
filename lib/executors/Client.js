define([
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'./Executor',
	'../Suite'
], function (
	has,
	lang,
	Promise,
	Executor,
	Suite
) {
	/**
	 * The Client executor is used to run unit tests in the local environment.
	 *
	 * @constructor module:intern/lib/executors/Client
	 * @extends module:intern/lib/executors/Executor
	 */
	function Client() {
		Executor.apply(this, arguments);
	}

	var _super = Executor.prototype;
	Client.prototype = lang.mixin(Object.create(_super), /** @lends module:intern/lib/executors/Client# */ {
		constructor: Client,

		config: {
			reporters: [ 'Console' ]
		},

		mode: 'client',

		run: function () {
			var self = this;

			var config = this.config;
			var suite = new Suite({
				name: null,
				grep: config.grep,
				sessionId: config.sessionId,
				reporterManager: this.reporterManager
			});
			this.suites = [ suite ];

			var promise = _super.run.apply(this, arguments)
				.then(function () {
					return self._loadTestModules(config.suites);
				})
				.then(function () {
					return self._runTests(function () {
						return suite.run();
					});
				});

			this.run = function () {
				return promise;
			};

			return promise;
		}
	});

	if (has('host-browser')) {
		Client.prototype.config.reporters.push('html');
	}

	return Client;
});
