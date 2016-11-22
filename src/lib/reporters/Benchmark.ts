/**
 * Benchmark is a reporter that can generate a baseline report and do runtime comparisons against an existing baseline.
 *
 * Configuration
 * -------------
 * Along with the default reporter options, Benchmark also supports a `mode` option. This can have two
 * values:
 *
 *     'baseline': Benchmark data will be written to a baseline file when testing is finished
 *     'test': Benchmark is compared to a baseline read from a file when testing starts
 *
 * Baseline data is stored hierarchically by environment and then by test. 
 *
 * Notation
 * --------
 * rme: relative margin of error -- margin of error as a percentage of the mean margin of error
 * mean: mean execution time per function run
 * hz: Hertz (number of executions of a function per second). 1/Hz is the mean execution time of function.
 */
define([ 'dojo/node!fs', '../util' ], function (fs, util) {
	// jshint node:true
	function formatSeconds(value) {
		var places;
		var units = 's';
		if (value < 1) {
			places = Math.ceil(Math.log(value) / Math.log(10)) - 1;
			if (places < -9) {
				value *= Math.pow(10, 12);
				units = 'ps';
			}
			else if (places < -6) {
				value *= Math.pow(10, 9);
				units = 'ns';
			}
			else if (places < -3) {
				value *= Math.pow(10, 6);
				units = 'µs';
			}
			else if (places < 0) {
				value *= Math.pow(10, 3);
				units = 'ms';
			}
		}

		return value.toFixed(3) + units;
	}

	function Benchmark(config) {
		this.config = config;

		this.mode = config.mode;
		this.thresholds = config.thresholds;
		this.verbosity = config.verbosity;

		// Logging levels
		this.debug = this.verbosity > 0 ? function () {
			config.console.log.apply(config.console, arguments);
		} : function () {};
		this.log = function () {
			config.console.log.apply(config.console, arguments);
		};
		this.warn = function () {
			config.console.warn.apply(config.console, arguments);
		};
		this.error = function () {
			config.console.error.apply(config.console, arguments);
		};

		// In test mode, try to load benchmark data for comparison
		if (this.mode === 'test') {
			try {
				this.baseline = JSON.parse(fs.readFileSync(config.filename, { encoding: 'utf8' }));
			}
			catch (error) {
				this.warn('Unable to load benchmark baseline data from ' + config.filename);
				this.warn('Switching to "baseline" mode');

				this.mode = 'baseline';
			}
		}

		if (!this.baseline) {
			this.baseline = { environments: {} };
		}

		// Cache environments by session ID so we can look them up again when serialized tests come back from remote
		// browsers
		this.sessions = {};
	}

	Benchmark.prototype = {
		constructor: Benchmark,

		_getSession: function (testOrSuite) {
			var sessionId = testOrSuite.sessionId || 'local';
			var session = this.sessions[sessionId];

			if (!session) {
				var environment;
				session = this.sessions[sessionId] = {
					suites: {}
				};

				if (testOrSuite.sessionId) {
					environment = testOrSuite.remote.environmentType;
					environment = session.environment = {
						client: environment.browserName,
						version: environment.version,
						platform: environment.platform
					};
				}
				else {
					environment = session.environment = {
						client: process.title,
						version: process.version,
						platform: process.platform
					};
				}

				session.environment.id = environment.client + ':' + environment.version + ':' + environment.platform;
			}

			return session;
		},

		runEnd: function () {
			if (this.mode === 'baseline') {
				var existingBaseline;
				try {
					existingBaseline = JSON.parse(fs.readFileSync(this.config.filename, { encoding: 'utf8' }));
				}
				catch (error) {
					existingBaseline = { environments: {} };
				}

				// Merge the newly recorded baseline data into the existing baseline data and write it back out to
				// output file.
				var baseline = this.baseline;
				Object.keys(baseline.environments).forEach(function (environmentId) {
					existingBaseline.environments[environmentId] = baseline.environments[environmentId];
				});
				fs.writeFileSync(this.config.filename, JSON.stringify(existingBaseline, null, '    '));
			}
		},

		suiteEnd: function (suite) {
			var session = this._getSession(suite);

			if (!suite.hasParent) {
				var environment = session.environment;
				this.log('Finished ' + environment.client + ' ' + environment.version + ' on ' + environment.platform);
			}
			else if (this.mode === 'test') {
				var suiteInfo = session.suites[suite.id];
				var numTests = suiteInfo.numBenchmarks;
				if (numTests > 0) {
					var numFailedTests = suiteInfo.numFailedBenchmarks;
					var message = numFailedTests + '/' + numTests + ' benchmarks failed in ' + suite.id;
					this[numFailedTests > 0 ? 'warn' : 'log'](message);
				}
			}
		},

		suiteStart: function (suite) {
			var session = this._getSession(suite);

			// This is a session root suite
			if (!suite.hasParent) {
				var environment = session.environment;
				var environmentName = environment.client + ' ' + environment.version + ' on ' + environment.platform;
				this.log((this.mode === 'baseline' ? 'Baselining' : 'Benchmark testing') + ' ' + environmentName);

				if (this.mode === 'baseline') {
					this.baseline.environments[environment.id] = {
						client: environment.client,
						version: environment.version,
						platform: environment.platform,
						tests: {}
					};
				}
				else if (!this.baseline.environments[environment.id]) {
					this.warn('No baseline data for ' + environmentName + '!');
				}
			}
			else {
				var suiteInfo = session.suites[suite.id] = {};
				suiteInfo.numBenchmarks = 0;
				suiteInfo.numFailedBenchmarks = 0;
			}
		},

		testPass: function (test, benchmark) {
			function checkTest() {
				var warn = [];
				var fail = [];
				var list;

				var baselineMean = baseline.stats.mean;
				var percentDifference = 100 * (benchmark.stats.mean - baselineMean) / baselineMean;
				if (Math.abs(percentDifference) > self.thresholds.warn.mean) {
					list = warn;
					if (Math.abs(percentDifference) > self.thresholds.fail.mean) {
						list = fail;
					}
					list.push('Execution time is ' + percentDifference.toFixed(1) + '% off');
				}

				var baselineRme = baseline.stats.rme;
				// RME is already a percent
				percentDifference = benchmark.stats.rme - baselineRme;
				if (Math.abs(percentDifference) > self.thresholds.warn.rme) {
					list = warn;
					if (Math.abs(percentDifference) > self.thresholds.fail.rme) {
						list = fail;
					}
					list.push('RME is ' + percentDifference.toFixed(1) + '% off');
				}

				if (fail.length) {
					self.error('FAIL ' + test.id + ' (' + fail.join(', ') + ')');
					return false;
				}
				else if (warn.length) {
					self.warn('WARN ' + test.id + ' (' + warn.join(', ') + ')');
				}
				else {
					self.log('PASS ' + test.id);
				}

				return true;
			}

			// Ignore non-benchmark tests
			if (!benchmark) {
				this.debug('Ignoring non-benchmark test ' + test.id);
				return;
			}

			var self = this;
			var session = this._getSession(test);
			var environment = session.environment;

			var suiteInfo = session.suites[test.parentId];
			suiteInfo.numBenchmarks++;

			if (this.mode === 'baseline') {
				this.baseline.environments[environment.id].tests[test.id] = {
					hz: benchmark.hz,
					times: benchmark.times,
					stats: {
						rme: benchmark.stats.rme,
						moe: benchmark.stats.moe,
						mean: benchmark.stats.mean
					}
				};
				this.log('Baselined ' + test.name);
				this.debug('  Time per run: ' + formatSeconds(benchmark.stats.mean) + ' \xb1 ' +
					benchmark.stats.rme.toFixed(2) + '%');
			}
			else {
				var baseline = this.baseline.environments[environment.id];
				if (baseline) {
					baseline = baseline.tests[test.id];
					var result = checkTest();
					this.debug('  Expected time per run: ' + formatSeconds(baseline.stats.mean) + ' \xb1 ' +
						baseline.stats.rme.toFixed(2) + '%');
					this.debug('  Actual time per run:   ' + formatSeconds(benchmark.stats.mean) + ' \xb1 ' +
						benchmark.stats.rme.toFixed(2) + '%');

					if (!result) {
						suiteInfo.numFailedBenchmarks++;
					}
				}
			}
		},

		testFail: function (test, error) {
			var session = this._getSession(test);
			var suiteInfo = session.suites[test.parentId];
			suiteInfo.numBenchmarks++;
			suiteInfo.numFailedBenchmarks++;

			this.error('ERROR: ' + test.id);
			this.error(util.getErrorMessage(error));
		}
	};

	return Benchmark;
});
