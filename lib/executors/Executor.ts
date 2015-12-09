import has = require('dojo/has');
import { deepDelegate, pullFromArray } from 'dojo/lang';
import Promise = require('dojo/Promise');
import * as intern from '../../main';
import PreExecutor from './PreExecutor';
import { InternConfig, ReporterConfig } from './PreExecutor';
import { default as ReporterManager, ReporterConstructor, ReporterKwArgs } from '../ReporterManager';
import Suite from '../Suite';
import * as util from '../util';
import { AmdRequire } from '../util';

declare var require: AmdRequire;

type TODO = any;
type MaybePromise = void | Promise.Thenable<void>;

export default class Executor {
	static defaultConfig: InternConfig = {
		coverageVariable: '__internCoverage',
		defaultTimeout: 30000,
		reporters: []
	};

	constructor(config: InternConfig, preExecutor: PreExecutor) {
		this.config = deepDelegate((<typeof Executor> this.constructor).defaultConfig, config);
		this.preExecutor = preExecutor;
	}

	/**
	 * The resolved configuration for this executor.
	 */
	config: InternConfig;

	_hasSuiteErrors = false;

	/**
	 * The type of the executor.
	 */
	mode: string = null;

	/**
	 * @type {module:intern/lib/executors/PreExecutor}
	 */
	preExecutor: PreExecutor = null;

	/**
	 * The reporter manager for this test execution.
	 */
	reporterManager: ReporterManager = new ReporterManager();

	/**
	 * The root suites managed by this executor.
	 */
	suites: Suite[] = null;

	/**
	 * Code to execute after the main test run has finished to shut down the test system.
	 */
	protected _afterRun() {
		return Promise.resolve(undefined);
	}

	/**
	 * Code to execute before the main test run has started to set up the test system.
	 *
	 * @returns Promise.<void>
	 */
	protected _beforeRun() {
		const self = intern.executor = this;
		const config = this.config;

		function enableInstrumentation() {
			if (config.excludeInstrumentation !== true) {
				return self.enableInstrumentation(
					config.basePath,
					config.excludeInstrumentation,
					config.coverageVariable
				);
			}
		}

		function loadReporters() {
			return self._loadReporters(config.reporters);
		}

		function registerErrorHandler() {
			self.reporterManager.on('suiteError', function () {
				self._hasSuiteErrors = true;
			});
			if (self.preExecutor) {
				return self.preExecutor.registerErrorHandler(self._handleError.bind(self));
			}
		}

		return Promise.resolve(undefined)
			.then(loadReporters)
			.then(registerErrorHandler)
			.then(enableInstrumentation);
	}

	/**
	 * Enables instrumentation for all code loaded into the current environment.
	 *
	 * @param {string} basePath The base path to use to calculate absolute paths for use by lcov.
	 * @param {RegExp} excludePaths A regular expression matching paths, relative to `basePath`, that should not be
	 * instrumented.
	 * @param {string} coverageVariable The global variable that should be used to store code coverage data.
	 * @returns {Handle} Remove handle.
	 */
	enableInstrumentation(basePath: string, excludePaths: boolean | RegExp, coverageVariable: string) {
		if (has('host-node')) {
			return util.setInstrumentationHooks(excludePaths, basePath, coverageVariable);
		}
	}

	/**
	 * The error handler for fatal errors (uncaught exceptions and errors within the test system itself).
	 *
	 * @returns A promise that resolves once the error has been sent to all registered error handlers.
	 */
	_handleError(error: Error) {
		return Promise.resolve(this.reporterManager && this.reporterManager.emit('fatalError', error));
	}

	/**
	 * Loads reporters into the reporter manager.
	 *
	 * @param reporters An array of reporter configuration objects.
	 * @returns {Promise.<void>}
	 */
	_loadReporters(reporters: Array<string | ReporterConfig>) {
		const self = this;
		const reporterManager = this.reporterManager;

		const LEGACY_REPORTERS: { [id: string]: string | ReporterConfig; } = {
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

		const reporterModuleIds = reporters.map(function (reporter) {
			let id: string;

			if (typeof reporter === 'string') {
				const replacementReporter = LEGACY_REPORTERS[reporter];
				if (replacementReporter) {
					id = (<ReporterConfig> replacementReporter).id || (<string> replacementReporter);

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
				id = '../reporters/' + id;
			}

			if (has('host-browser')) {
				util.assertSafeModuleId(id);
			}

			return id;
		});

		return util.getModules<ReporterConstructor>(reporterModuleIds, require).then(function (args) {
			for (let i = 0, Reporter: ReporterConstructor; (Reporter = args[i]); ++i) {
				let kwArgs: ReporterKwArgs;

				const userConfig = reporters[i];

				// reporter was simply specified as a string
				if (typeof userConfig === 'string') {
					const replacementReporter = LEGACY_REPORTERS[<string> userConfig];
					if (replacementReporter && typeof replacementReporter !== 'string') {
						kwArgs = replacementReporter;
					}
					else {
						kwArgs = <ReporterConfig> {};
					}
				}
				else {
					kwArgs = userConfig;
				}

				// pass each reporter the full intern config as well as its own options
				kwArgs.internConfig = self.config;
				reporterManager.add(Reporter, kwArgs);
			}

			return reporterManager.run();
		});
	}

	/**
	 * Loads test modules, which register suites for testing within the test system.
	 *
	 * @param {string[]} moduleIds The IDs of the test modules to load.
	 * @return {Promise.<void>}
	 */
	_loadTestModules(moduleIds: string[]) {
		if (!moduleIds || !moduleIds.length) {
			return Promise.resolve(undefined);
		}

		if (has('host-browser')) {
			moduleIds.forEach(util.assertSafeModuleId);
		}

		return new Promise(function (resolve, reject) {
			require(moduleIds, function () {
				// resolve should receive no arguments
				resolve();
			}, reject);
		});
	}

	/**
	 * Register tests on the root suites.
	 */
	register(callback: (rootSuite: Suite) => void) {
		this.suites.forEach(callback);
	}

	/**
	 * Sets up the environment for test execution with instrumentation, reporting, and error handling. Subclasses
	 * should typically override `_runTests` to execute tests.
	 *
	 * @returns {Promise.<void>}
	 */
	run(): Promise<number> {
		const self = this;

		function emitFatalError(error: Error): Promise<any> {
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

		function runConfigSetup() {
			return Promise.resolve(self.config.setup && self.config.setup(self));
		}

		function runConfigTeardown() {
			return Promise.resolve(self.config.teardown && self.config.teardown(self));
		}

		function runTests() {
			return self._runTests(self.config.maxConcurrency);
		}

		const promise = this._beforeRun()
			.then(function () {
				return runConfigSetup().then(function () {
					return emitRunStart()
						.then(runTests)
						.finally(emitRunEnd);
				})
				.finally(runConfigTeardown);
			})
			.finally(self._afterRun.bind(self))
			.then(function () {
				if (self._hasSuiteErrors) {
					throw new Error('One or more suite errors occurred during testing');
				}

				return self.suites.reduce(function (numFailedTests, suite) {
					return numFailedTests + suite.numFailedTests;
				}, 0);
			})
			.catch<number>(emitFatalError);

		this.run = function () {
			return promise;
		};

		return promise;
	}

	/**
	 * Runs each of the root suites, limited to a certain number of suites at the same time by `maxConcurrency`.
	 */
	_runTests(maxConcurrency: number) {
		maxConcurrency = maxConcurrency || Infinity;

		const self = this;
		const suites = this.suites;
		let numSuitesCompleted = 0;
		const numSuitesToRun = suites.length;
		const queue = util.createQueue(maxConcurrency);
		let hasError = false;

		return new Promise(function (resolve, reject, progress, setCanceler) {
			const runningSuites: Promise<void>[] = [];

			setCanceler(function (reason) {
				queue.empty();

				const cancellations: MaybePromise[] = [];
				let task: Promise<void>;
				while ((task = runningSuites.pop())) {
					cancellations.push(task.cancel && task.cancel(reason));
				}

				return Promise.all(cancellations).then(function () {
					throw reason;
				});
			});

			function emitLocalCoverage() {
				const error = new Error('Run failed due to one or more suite errors');

				const coverageData = (function () { return this; })()[self.config.coverageVariable];
				if (coverageData) {
					return self.reporterManager.emit('coverage', null, coverageData).then(function () {
						if (hasError) {
							throw error;
						}
					});
				}
				else if (hasError) {
					return Promise.reject(error);
				}
			}

			function finishSuite() {
				if (++numSuitesCompleted === numSuitesToRun) {
					resolve(emitLocalCoverage());
				}
			}

			if (suites && suites.length) {
				suites.forEach(queue(function (suite) {
					const runTask = suite.run().then(finishSuite, function () {
						hasError = true;
						finishSuite();
					});
					runningSuites.push(runTask);
					runTask.finally(function () {
						pullFromArray(runningSuites, runTask);
					});
					return runTask;
				}));
			}
			else {
				resolve(emitLocalCoverage());
			}
		});
	}
};
