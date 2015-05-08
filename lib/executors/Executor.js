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
	function Executor(config, preExecutor) {
		this.config = lang.deepDelegate(this.config, config);
		this.reporterManager = new ReporterManager();
		this.preExecutor = preExecutor;
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
		 * The type of the executor.
		 *
		 * @type {string}
		 */
		mode: null,

		/**
		 * @type {module:intern/lib/executors/PreExecutor}
		 */
		preExecutor: null,

		/**
		 * The reporter manager for this test execution.
		 *
		 * @type {ReporterManager}
		 */
		reporterManager: null,

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
			return Promise.resolve();
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
				if (config.excludeInstrumentation !== true) {
					return self.enableInstrumentation(config.basePath, config.excludeInstrumentation);
				}
			}

			function loadReporters() {
				return self._loadReporters(config.reporters);
			}

			function registerErrorHandler() {
				return self.preExecutor.registerErrorHandler(lang.bind(self, '_handleError'));
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
		 * @returns A promise that resolves once the error has been sent to all registered error handlers.
		 */
		_handleError: function (error) {
			return Promise.resolve(this.reporterManager && this.reporterManager.emit('fatalError', error));
		},

		/**
		 * Loads reporters into the reporter manager.
		 *
		 * @param {(Object|string)[]} reporters An array of reporter configuration objects.
		 * @returns {Promise.<void>}
		 */
		_loadReporters: function (reporters) {
			var self = this;
			var reporterManager = this.reporterManager;

			var LEGACY_REPORTERS = {
				'cobertura': { id: 'Cobertura', filename: 'cobertura-coverage.xml' },
				'combined': 'Combined',
				'console': 'Console',
				'html': 'Html',
				'junit': { id: 'JUnit', filename: 'report.xml' },
				'lcov': { id: 'Lcov', filename: 'lcov.info' },
				'lcovhtml': { id: 'LcovHtml', directory: 'html-report' },
				'pretty': 'Pretty',
				'runner': 'Runner',
				'teamcity': 'TeamCity',
				'webdriver': 'WebDriver'
			};

			var reporterModuleIds = reporters.map(function (reporter) {
				var id;

				if (typeof reporter === 'string') {
					var replacementReporter = LEGACY_REPORTERS[reporter];
					if (replacementReporter) {
						id = replacementReporter.id || replacementReporter;

						reporterManager.emit(
							'deprecated',
							'The reporter ID "' + reporter + '"',
							JSON.stringify(replacementReporter)
						);
					}
					else {
						id = reporter;
					}
				}
				else {
					id = reporter.id;
				}

				if (id.indexOf('/') === -1) {
					id = require.toAbsMid('../reporters/' + id);
				}

				if (has('host-browser')) {
					util.assertSafeModuleId(id);
				}

				return id;
			});

			return new Promise(function (resolve, reject) {
				require(reporterModuleIds, function () {
					try {
						for (var i = 0, Reporter; (Reporter = arguments[i]); ++i) {
							var kwArgs = reporters[i];

							// reporter was simply specified as a string
							if (typeof kwArgs === 'string') {
								var replacementReporter = LEGACY_REPORTERS[kwArgs];
								if (replacementReporter && typeof replacementReporter !== 'string') {
									kwArgs = LEGACY_REPORTERS[kwArgs];
								}
								else {
									kwArgs = {};
								}
							}

							// pass each reporter the full intern config as well as its own options
							kwArgs.internConfig = self.config;
							reporterManager.add(Reporter, kwArgs);
						}

						resolve(reporterManager.run());
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
				return self._handleError(error).then(function () {
					throw error;
				});
			}

			function emitRunEnd() {
				return self.reporterManager.emit('runEnd', self);
			}

			function emitRunStart() {
				return self.reporterManager.emit('runStart', self);
			}

			function runAfterConfig() {
				return Promise.resolve(self.config.after && self.config.after(self));
			}

			function runBeforeConfig() {
				return Promise.resolve(self.config.before && self.config.before(self));
			}

			function runTests() {
				return self._runTests(self.config.maxConcurrency);
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
				.finally(lang.bind(self, '_afterRun'))
				.then(function () {
					return self.suites.reduce(function (numFailedTests, suite) {
						return numFailedTests + suite.numFailedTests;
					}, 0);
				})
				.catch(emitFatalError);

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

			var self = this;
			var reporterManager = this.reporterManager;
			var suites = this.suites;
			var numSuitesCompleted = 0;
			var numSuitesToRun = suites.length;
			var queue = util.createQueue(maxConcurrency);

			return new Promise(function (resolve, reject, progress, setCanceler) {
				var runningSuites = [];

				setCanceler(function (reason) {
					queue.empty();

					var cancellations = [];
					var task;
					while ((task = runningSuites.pop())) {
						cancellations.push(task.cancel && task.cancel(reason));
					}

					return Promise.all(cancellations).then(function () {
						throw reason;
					});
				});

				function emitLocalCoverage() {
					/* global __internCoverage:false */
					if (typeof __internCoverage !== 'undefined') {
						return self.reporterManager.emit('coverage', null, __internCoverage);
					}
				}

				function finishSuite() {
					if (++numSuitesCompleted === numSuitesToRun) {
						resolve(emitLocalCoverage());
					}
				}

				suites.forEach(queue(function (suite) {
					var runTask = suite.run().then(finishSuite, function (error) {
						return reporterManager.emit('suiteError', suite, error).then(finishSuite);
					});
					runningSuites.push(runTask);
					runTask.finally(function () {
						lang.pullFromArray(runningSuites, runTask);
					});
					return runTask;
				}));
			});
		}
	};

	return Executor;
});
