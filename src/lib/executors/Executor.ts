import { ReporterDescriptor, ReporterManager, ReporterConstructor } from '../ReporterManager';
import { Config } from '../../interfaces';
import { PreExecutor } from './PreExecutor';
import { Suite } from '../Suite';
import * as util from '../util';

// Legacy imports
import * as intern from '../../main';

// AMD modules
import * as has from 'dojo/has';
import * as lang from 'dojo/lang';
import * as Promise from 'dojo/Promise';
import { IRequire } from 'dojo/loader';

declare const require: IRequire;

const globalOrWindow = Function('return this')();

export class Executor {
	/** The resolved configuration for this executor. */
	config: Config = {
		instrumenterOptions: {
			coverageVariable: '__internCoverage'
		},
		defaultTimeout: 30000,
		reporters: []
	};

	/** The type of the executor. */
	mode: string;

	preExecutor: PreExecutor;

	/** The reporter manager for this test execution. */
	reporterManager: ReporterManager;

	/** The root suites managed by this executor. */
	suites: Suite[];

	protected _hasSuiteErrors = false;

	constructor(config: Config, preExecutor: PreExecutor) {
		this.config = lang.deepDelegate(this.config, config);
		this.reporterManager = new ReporterManager();
		this.preExecutor = preExecutor;
	}

	/**
	 * Enables instrumentation for all code loaded into the current environment.
	 *
	 * @param basePath The base path to use to calculate absolute paths for use by lcov.
	 * @param excludePaths A regular expression matching paths, relative to `basePath`, that should not be
	 * instrumented.
	 * @param instrumenterOptions Extra options for the instrumenter
	 */
	enableInstrumentation(basePath: string, excludePaths: RegExp, instrumenterOptions: { [key: string]: string }) {
		if (has('host-node')) {
			return util.setInstrumentationHooks(excludePaths, basePath, instrumenterOptions);
		}
	}

	/**
	 * Register tests on the root suites.
	 */
	register(callback: (suite: Suite) => void) {
		this.suites.forEach(callback);
	}

	/**
	 * Sets up the environment for test execution with instrumentation, reporting, and error handling. Subclasses
	 * should typically override `_runTests` to execute tests.
	 */
	run() {
		const self = this;

		function emitFatalError(error: Error) {
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
			.finally(function () {
				return self._afterRun();
			})
			.then(function () {
				if (self._hasSuiteErrors) {
					throw new Error('One or more suite errors occurred during testing');
				}

				return self.suites.reduce(function (numFailedTests, suite) {
					return numFailedTests + suite.numFailedTests;
				}, 0);
			})
			.catch(emitFatalError);

		this.run = function () {
			return promise;
		};

		return promise;
	}

	/**
	 * Code to execute after the main test run has finished to shut down the test system.
	 */
	protected _afterRun() {
		return Promise.resolve();
	}

	/**
	 * Code to execute before the main test run has started to set up the test system.
	 */
	protected _beforeRun() {
		const self = this;
		intern.setExecutor(this);
		const config = this.config;

		function enableInstrumentation() {
			if (config.excludeInstrumentation !== true) {
				return self.enableInstrumentation(
					config.basePath,
					(<RegExp> config.excludeInstrumentation),
					config.instrumenterOptions
				);
			}
		}

		function registerErrorHandler() {
			self.reporterManager.on('suiteError', function () {
				self._hasSuiteErrors = true;
			});
			return self.preExecutor.registerErrorHandler((error: Error) => {
				return self._handleError(error);
			});
		}

		return this._loadReporters(config.reporters)
			.then(registerErrorHandler)
			.then(enableInstrumentation);
	}

	/**
	 * The error handler for fatal errors (uncaught exceptions and errors within the test system itself).
	 *
	 * @returns A promise that resolves once the error has been sent to all registered error handlers.
	 */
	protected _handleError(error: Error) {
		return Promise.resolve(this.reporterManager && this.reporterManager.emit('fatalError', error));
	}

	/**
	 * Loads reporters into the reporter manager.
	 *
	 * @param reporters An array of reporter configuration objects.
	 */
	protected _loadReporters(reporters: (ReporterDescriptor|String)[]) {
		const reporterManager = this.reporterManager;

		const LEGACY_REPORTERS: { [name: string]: (string|ReporterDescriptor) } = {
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
				const replacementReporter = LEGACY_REPORTERS[<string> reporter];
				if (replacementReporter) {
					id = (<ReporterDescriptor> replacementReporter).id || (<string> replacementReporter);

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
				id = (<ReporterDescriptor> reporter).id;
			}

			if (id.indexOf('/') === -1) {
				id = '../reporters/' + id;
			}

			if (has('host-browser')) {
				util.assertSafeModuleId(id);
			}

			return id;
		});

		return new Promise((resolve, reject) => {
			const config = this.config;

			require(reporterModuleIds, function () {
				try {
					Array.prototype.slice.call(arguments).forEach(function (Reporter: (ReporterConstructor|Object), i: number) {
						const rawArgs = reporters[i];
						let kwArgs: ReporterDescriptor;

						// reporter was simply specified as a string
						if (typeof rawArgs === 'string') {
							const reporterName = <string> rawArgs;
							const replacementReporter = LEGACY_REPORTERS[reporterName];
							if (replacementReporter && typeof replacementReporter !== 'string') {
								kwArgs = <ReporterDescriptor> LEGACY_REPORTERS[reporterName];
							}
							else {
								kwArgs = <ReporterDescriptor> {};
							}
						}

						// pass each reporter the full intern config as well as its own options
						kwArgs.internConfig = config;
						reporterManager.add(Reporter, kwArgs);
					});

					resolve(reporterManager.run());
				}
				catch (error) {
					reject(error);
				}
			});
		});
	}

	/**
	 * Loads test modules, which register suites for testing within the test system.
	 *
	 * @param moduleIds The IDs of the test modules to load.
	 */
	protected _loadTestModules(moduleIds: string[]) {
		if (!moduleIds || !moduleIds.length) {
			return Promise.resolve();
		}

		if (has('host-browser')) {
			moduleIds.forEach(util.assertSafeModuleId);
		}

		return new Promise(function (resolve, reject) {
			// TODO: require doesn't support reject
			(<any> require)(moduleIds, function () {
				// resolve should receive no arguments
				resolve();
			}, reject);
		});
	}

	/**
	 * Runs each of the root suites, limited to a certain number of suites at the same time by `maxConcurrency`.
	 */
	protected _runTests(maxConcurrency: number) {
		maxConcurrency = maxConcurrency || Infinity;

		const self = this;
		const suites = this.suites;
		let numSuitesCompleted = 0;
		const numSuitesToRun = suites.length;
		const queue = util.createQueue(maxConcurrency);
		let hasError = false;

		return new Promise(function (resolve, reject, progress, setCanceler) {
			const runningSuites: Promise<any>[] = [];

			setCanceler(function (reason) {
				queue.empty();

				let cancellations: any[] = [];
				let task: Promise<any>;
				while ((task = runningSuites.pop())) {
					cancellations.push(task.cancel && task.cancel(reason));
				}

				return Promise.all(cancellations).then(function () {
					throw reason;
				});
			});

			function emitLocalCoverage() {
				let error = new Error('Run failed due to one or more suite errors');

				let coverageData = globalOrWindow[self.config.instrumenterOptions.coverageVariable];
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
				suites.forEach(queue(function (suite: Suite) {
					let runTask = suite.run().then(finishSuite, function () {
						hasError = true;
						finishSuite();
					});
					runningSuites.push(runTask);
					runTask.finally(function () {
						lang.pullFromArray(runningSuites, runTask);
					});
					return runTask;
				}));
			}
			else {
				resolve(emitLocalCoverage());
			}
		});
	}
}
