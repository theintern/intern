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

		_afterRun: function () {
			var self = this;

			function unloadReporters() {
				self.reporterManager.empty();
			}

			return _super._afterRun.apply(this, arguments).finally(unloadReporters);
		},

		_beforeRun: function () {
			var self = this;
			var config = this.config;
			var suite = new Suite({
				name: null,
				grep: config.grep,
				sessionId: config.sessionId,
				reporterManager: this.reporterManager
			});
			this.suites = [ suite ];

			function loadTestModules() {
				return self._loadTestModules(config.suites);
			}

			return _super._beforeRun.apply(this, arguments).then(loadTestModules);
		},

		_runTests: function () {
			return this.suites[0].run();
		}
	});

	if (has('host-browser')) {
		Client.prototype.config.reporters.push('html');
	}

	return Client;
});
