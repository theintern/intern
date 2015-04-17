define([
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'../../main',
	'../ReporterManager',
	'../util',
	'require'
], function (
	has,
	lang,
	Promise,
	intern,
	ReporterManager,
	util,
	require
) {
	function Executor(config, global) {
		this.config = lang.deepDelegate(this.config, config);
		this.reporterManager = new ReporterManager();
		this.global = global;
	}

	Executor.prototype = {
		constructor: Executor,

		/**
		 * The resolved configuration for this executor.
		 *
		 * @type {Object}
		 */
		config: {},

		/**
		 * @type {module:intern/lib/executors/PreExecutor}
		 */
		global: null,

		/**
		 * The type of the executor.
		 *
		 * @type {string}
		 */
		mode: null,

		/**
		 * The reporter manager for this test execution.
		 *
		 * @type {ReporterManager}
		 */
		reporterManager: null,

		/**
		 * True if reporters have been loaded into reporterManager.
		 *
		 * @type {boolean}
		 */
		reportersReady: false,

		/**
		 * The root suites managed by this executor.
		 *
		 * @type {Suite[]}
		 */
		suites: null,

		/**
		 * Code to execute after the main test run has finished to shut down the test system.
		 *
		 * @returns Promise.<void>
		 */
		_afterRun: function () {
			var self = this;

			function emitLocalCoverage() {
				/* global __internCoverage:false */
				if (typeof __internCoverage !== 'undefined') {
					return self.reporterManager.emit('coverage', null, __internCoverage);
				}
			}

			return Promise.resolve()
				.then(emitLocalCoverage);
		},

		/**
		 * Code to execute before the main test run has started to set up the test system.
		 *
		 * @returns Promise.<void>
		 */
		_beforeRun: function () {
			var self = intern.executor = this;
			var config = this.config;

			function enableInstrumentation() {
				return self.enableInstrumentation(config.basePath, config.excludeInstrumentation);
			}

			function loadReporters() {
				return self._loadReporters(config.reporters);
			}

			function registerErrorHandler() {
				return self.global.registerErrorHandler(lang.bind(this, '_handleError'));
			}

			return Promise.resolve()
				.then(loadReporters)
				.then(registerErrorHandler)
				.then(enableInstrumentation);
		},

		/**
		 * Enables instrumentation for all code loaded into the current environment.
		 *
		 * @param {string} basePath The base path to use to calculate absolute paths for use by lcov.
		 * @param {RegExp} excludePaths A regular expression matching paths, relative to `basePath`, that should not be
		 * instrumented.
		 * @returns {Handle} Remove handle.
		 */
		enableInstrumentation: function (basePath, excludePaths) {
			if (has('host-node')) {
				return util.setInstrumentationHooks(excludePaths, basePath);
			}
		},

		/**
		 * The error handler for fatal errors (uncaught exceptions and errors within the test system itself).
		 *
		 * @param {Error} error
		 */
		_handleError: function (error) {
			this.reporterManager.emit('fatalError', error);
		},

		/**
		 * Loads reporters into the reporter manager.
		 *
		 * @param {(Object|string)[]} reporters An array of reporter configuration objects.
		 * @returns {Promise.<void>}
		 */
		_loadReporters: function (reporters) {
			var reporterModuleIds = reporters.map(function (reporter) {
				var id;

				if (typeof reporter === 'string') {
					id = reporter;
				}
				else {
					id = reporter.constructor;
				}

				if (id.indexOf('/') === -1) {
					id = require.toAbsMid('../reporters/' + id);
				}

				if (has('host-browser')) {
					util.assertSafeModuleId(id);
				}

				return id;
			});

			var reporterManager = this.reporterManager;
			var self = this;

			return new Promise(function (resolve, reject) {
				require(reporterModuleIds, function () {
					try {
						for (var i = 0, Reporter; (Reporter = arguments[i]); ++i) {
							var kwArgs = reporters[i];

							// reporter was simply specified as a string
							if (typeof kwArgs === 'string') {
								kwArgs = {};
							}

							// pass each reporter the full intern config as well as its own options
							kwArgs.intern = self.config;
							reporterManager.add(Reporter, kwArgs);
						}

						resolve(reporterManager.emit('run').then(function () {
							self.reportersReady = true;
						}));
					}
					catch (error) {
						reject(error);
					}
				});
			});
		},

		/**
		 * Loads test modules, which register suites for testing within the test system.
		 *
		 * @param {Suite[]} rootSuites The suites upon which tests from the test modules should be registered.
		 * @param {string[]} moduleIds The IDs of the test modules to load.
		 * @return {Promise.<void>}
		 */
		_loadTestModules: function (moduleIds) {
			if (has('host-browser')) {
				moduleIds.forEach(util.assertSafeModuleId);
			}

			return new Promise(function (resolve, reject) {
				require(moduleIds, function () {
					// resolve should receive no arguments
					resolve();
				}, reject);
			});
		},

		/**
		 * Register tests on the root suites.
		 */
		register: function (callback) {
			this.suites.forEach(callback);
		},

		/**
		 * Sets up the environment for test execution with instrumentation, reporting, and error handling. Subclasses
		 * should typically override `_runTests` to execute tests.
		 *
		 * @returns {Promise.<void>}
		 */
		run: function () {
			var self = this;

			function emitFatalError(error) {
				return self.reporterManager.emit('fatalError', error).then(function () {
					throw error;
				});
			}

			function emitRunEnd() {
				return self.reporterManager.emit('runEnd', self).catch(function () {});
			}

			function emitRunStart() {
				return self.reporterManager.emit('runStart', self).catch(function () {});
			}

			function runAfterConfig() {
				return Promise.resolve(self.config.after && self.config.after(self));
			}

			function runBeforeConfig() {
				return Promise.resolve(self.config.before && self.config.before(self));
			}

			function runTests() {
				return self._runTests(self.config.maxConcurrency).catch(emitFatalError);
			}

			var promise = this._beforeRun()
				.then(function () {
					return runBeforeConfig().then(function () {
						return emitRunStart()
							.then(runTests)
							.finally(emitRunEnd);
					})
					.finally(runAfterConfig);
				})
				.then(lang.bind(self, '_afterRun'))
				// TODO: This is running on system failure
				.then(function () {
					return self.suites.reduce(function (numFailedTests, suite) {
						return numFailedTests + suite.numFailedTests;
					}, 0);
				});

			this.run = function () {
				return promise;
			};

			return promise;
		},

		/**
		 * Runs each of the root suites, limited to a certain number of suites at the same time by `maxConcurrency`.
		 *
		 * @param {Suite[]} suites The root suites.
		 * @returns {Promise.<void>}
		 */
		_runTests: function (maxConcurrency) {
			maxConcurrency = maxConcurrency || Infinity;

			var reporterManager = this.reporterManager;
			var suites = this.suites;
			var numSuitesCompleted = 0;
			var numSuitesToRun = suites.length;
			var queue = util.createQueue(maxConcurrency);

			return new Promise(function (resolve, reject, progress, setCanceler) {
				var currentSuite;

				setCanceler(function (reason) {
					queue.empty();
					currentSuite.cancel && currentSuite.cancel(reason);
					throw reason;
				});

				suites.forEach(queue(function (suite) {
					return suite.run().then(function () {
						if (++numSuitesCompleted === numSuitesToRun) {
							resolve();
						}
					}, function (error) {
						return reporterManager.emit('suiteError', suite, error);
					});
				}));
			});
		}
	};

	return Executor;
});
