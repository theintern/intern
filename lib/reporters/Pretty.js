/**
 * Handles presentation of runner results to the user
 */
define([
	'dojo/node!charm',
	'dojo/node!charm/lib/encode',
	'dojo/node!util',
	'dojo/lang',
	'intern/lib/util',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (Charm, encode, nodeUtil, lang, internUtil, Collector, Reporter) {
	/* globals process */

	var PAD = new Array(100).join(' ');
	var SPINNER_STATES = [ '/', '-', '\\', '|' ];
	var PASS = 0;
	var SKIP = 1;
	var FAIL = 2;
	var BROWSERS = {
		chrome: 'Chr',
		firefox: 'Fx',
		opera: 'O',
		safari: 'Saf',
		'internet explorer': 'IE',
		phantomjs: 'Phan'
	};
	var ASCII_COLOR = {
		red: encode('[31m'),
		green: encode('[32m'),
		reset: encode('[0m')
	};

	/**
	 * Model tracking test results
	 * @param type the environment or string describing this report
	 * @constructor
	 */
	function Report(type) {
		this.type = type || '';
		this.numTotal = 0;
		this.numPassed = 0;
		this.numFailed = 0;
		this.numSkipped = 0;
		this.results = [];
		this.coverage = new Collector();
	}

	Report.prototype = {
		get finished() {
			return this.results.length;
		},

		record: function (result) {
			this.results.push(result);
			switch (result) {
			case PASS:
				++this.numPassed;
				break;
			case SKIP:
				++this.numSkipped;
				break;
			case FAIL:
				++this.numFailed;
				break;
			}
		},

		getCompressedResults: function (maxWidth) {
			var total = Math.max(this.numTotal, this.results.length);
			var width = Math.min(maxWidth, total);
			var resultList = [];

			for (var i = 0; i < this.results.length; ++i) {
				var pos = Math.floor(i / total * width);
				resultList[pos] = Math.max(resultList[pos] || PASS, this.results[i]);
			}

			return resultList;
		}
	};

	function pad(width) {
		return PAD.slice(0, Math.max(width, 0));
	}

	function fit(text, width, padLeft) {
		text = String(text);
		if (text.length < width) {
			if (padLeft) {
				return pad(width - text.length) + text;
			}
			return text + pad(width - text.length);
		}
		return text.slice(0, width);
	}

	function Pretty(config) {
		this.options = lang.deepMixin({
			titleWidth: 12,
			maxProgressBarWidth: 40,
			colorReplacement: {
				0: ASCII_COLOR.green + '✓',
				1: ASCII_COLOR.reset + '~',
				2: ASCII_COLOR.red + '×',
				'✓': ASCII_COLOR.green,
				'!': ASCII_COLOR.reset,
				'×': ASCII_COLOR.red,
				'~': ASCII_COLOR.reset,
				'⚠': ASCII_COLOR.reset
			}
		}, config);

		this.spinnerOffset = 0;
		this.dimensions = this.options.dimensions || {};
		this.header = '';
		this.reporters = {};
		this.sessions = [];
		this.log = [];
		this.total = new Report();
		this.tunnelState = '';
		this._renderTimeout = undefined;
	}

	Pretty.prototype = {
		start: function () {
			this.header = this.config.intern;
			this.charm = this.charm || this._newCharm();

			var self = this;
			function resize() {
				self.dimensions.width = process.stdout.columns || 80;
				self.dimensions.height = process.stdout.rows || 24;
			}
			resize();
			process.stdout.on('resize', resize);

			(function rerender() {
				self.charm.erase('screen').position(0, 0);
				self._render();
				self._renderTimeout = setTimeout(rerender, 200);
			})();
		},

		stop: function () {
			var charm = this.charm;
			clearTimeout(this._renderTimeout);
			charm.erase('screen').position(0, 0);

			// write a full log of errors
			// Sort logs: pass < deprecated < skip < errors < fail
			var ERROR_LOG_WEIGHT = { '!': 4, '×': 3, '~': 2, '⚠': 1, '✓': 0 };
			var logs = this.log.sort(function (a, b) {
				a = ERROR_LOG_WEIGHT[a.charAt(0)] || 0;
				b = ERROR_LOG_WEIGHT[b.charAt(0)] || 0;
				return a - b;
			}).map(function (line) {
				var color = this.options.colorReplacement[line.charAt(0)];
				return color + line;
			}, this).join('\n');
			charm.write(logs);
			charm.write('\n\n');

			// Display the pretty results
			this._render(true);

			// Display coverage information
			charm.write('\n');
			(new Reporter()).writeReport(this.total.coverage, true);
		},

		sessionStart: function (remote) {
			this.reporters[remote.sessionId] = new Report(remote.environmentType);
			this.sessions.push(remote.sessionId);
		},

		coverage: function (sessionId, coverage) {
			var reporter = this.reporters[sessionId];
			reporter && reporter.coverage.add(coverage);
			this.total.coverage.add(coverage);
		},

		suiteStart: function (suite) {
			if (suite.name === 'main' && !suite.parent) {
				var reporter = this.reporters[suite.sessionId];
				var numTests = suite.numTests;
				reporter && (reporter.numTotal += numTests);
				this.total.numTotal += numTests;
			}
		},

		testSkip: function (test) {
			this._record(test.sessionId, SKIP);
			this.log.push('~ ' + this._getId(test) + ': ' + test.skipped);
		},

		testPass: function (test) {
			this._record(test.sessionId, PASS);
			this.log.push('✓ ' + this._getId(test));
		},

		testFail: function (test) {
			var message = '× ' + this._getId(test);
			this._record(test.sessionId, FAIL);
			this.log.push(message + '\n' + internUtil.getErrorMessage(test.error));
		},

		tunnelStart: function () {
			this.tunnelState = 'Starting';
		},

		tunnelDownloadProgress: function (tunnel, progress) {
			this.tunnelState = 'Downloading ' + (progress.received / progress.numTotal * 100).toFixed(2) + '%';
		},

		tunnelStatus: function (tunnel, status) {
			this.tunnelState = status;
		},

		runnerStart: function () {
			this.tunnelState = 'Ready';
		},

		error: function (error) {
			var message = '! ' + error.message;
			this.log.push(message);
		},

		deprecated: function (name, replacement) {
			var message = '⚠ ' + name + ' is deprecated. Use ' + replacement + ' instead.';
			this.log.push(message);
		},

		/**
		 * Create the charm instance used by this reporter.
		 */
		_newCharm: function () {
			var charm = new Charm();
			charm.pipe(process.stdout);
			return charm;
		},

		_record: function (sessionId, result) {
			var reporter = this.reporters[sessionId];
			reporter && reporter.record(result);
			this.total.record(result);
		},

		_getId: function (test) {
			var id = test.id;
			var reporter = this.reporters[test.sessionId];

			if (reporter) {
				id = id.replace(/^main/, String(reporter.type));
			}

			return id;
		},

		/**
		 * Render the progress bar
		 * [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 99/100
		 * @param report the report data to render
		 * @param width the maximum width for the entire progress bar
		 */
		_drawProgressBar: function (report, width) {
			var spinnerCharacter = SPINNER_STATES[this.spinnerOffset];
			var charm = this.charm;
			if (!report.numTotal) {
				charm.write('Pending');
				return;
			}

			var totalTextSize = String(report.numTotal).length;
			var remainingWidth = Math.max(width - 4 - (totalTextSize * 2), 1);
			var barSize = Math.min(remainingWidth, report.numTotal, this.options.maxProgressBarWidth);
			var results = report.getCompressedResults(barSize);

			charm.write('[' + results.map(function (value) {
				return this.options.colorReplacement[value];
			}, this).join(''));
			charm.display('reset').write(fit(spinnerCharacter, barSize - results.length) + '] ' +
				fit(report.finished, totalTextSize, true) + '/' + report.numTotal);
		},

		/**
		 * Render a single line
		 * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
		 * TODO split this into two lines. The first line will display the
		 * title, OS and code coverage and the progress bar on the second
		 */
		_drawReporter: function (report) {
			var charm = this.charm;
			var titleWidth = this.options.titleWidth;
			var leftOfBar = fit(this._abbreviateEnvironment(report.type).slice(0, titleWidth - 2) + ': ', titleWidth);
			var rightOfBar = '' +
				(report.numFailed ? ', ' + report.numFailed + ' fail' : '') +
				(report.numSkipped ? ', ' + report.numSkipped + ' skip' : '');
			var barWidth = this.dimensions.width - rightOfBar.length - titleWidth;

			charm.write(leftOfBar);
			this._drawProgressBar(report, barWidth);
			charm.write(rightOfBar + '\n');
		},

		/**
		 * Abbreviate the environment information for rendering
		 * @param env the test environment
		 * @returns {string} abbreviated environment information
		 */
		_abbreviateEnvironment: function (env) {
			var browser = BROWSERS[env.browserName.toLowerCase()] || env.browserName.slice(0, 4);
			var result = [browser];

			if (env.version) {
				var version = String(env.version);
				if (version.indexOf('.') > -1) {
					version = version.slice(0, version.indexOf('.'));
				}
				result.push(version);
			}

			if (env.platform) {
				result.push(env.platform.slice(0, 3));
			}

			return result.join(' ');
		},

		_render: function (omitLogs) {
			var charm = this.charm;
			var logLength = this.dimensions.height - this.sessions.length - 4 /* last line & total */ -
				(this.tunnelState ? 2 : 0) - (this.sessions.length ? 1 : 0) - (this.header ? 1 : 0);
			this.spinnerOffset = (++this.spinnerOffset) % SPINNER_STATES.length;

			charm.display('reset');
			this.header && charm.write(this.header + '\n');
			this.tunnelState && charm.write('Tunnel: ' + this.tunnelState + '\n\n');
			this._drawTotalReporter(this.total);

			// TODO if there is not room to render all reporters only render
			// active ones or only the total with less space
			if (this.sessions.length) {
				charm.write('\n');
				this.sessions.forEach(function (sessionId) {
					this._drawReporter(this.reporters[sessionId]);
				}, this);
			}

			if (!omitLogs && logLength > 0 && this.log.length) {
				var allowed = { '×': true, '⚠': true, '!': true };
				var logs = this.log.filter(function (line) {
					return allowed[line.charAt(0)];
				}).slice(-logLength).map(function (line) {
					// truncate long lines
					var color = this.options.colorReplacement[line.charAt(0)] || ASCII_COLOR.reset;
					line = line.split('\n', 1)[0];
					return color + line.slice(0, this.dimensions.width) + ASCII_COLOR.reset;
				}, this).join('\n');
				charm.write('\n');
				charm.write(logs);
			}
		},

		_drawTotalReporter: function (report) {
			var charm = this.charm;
			var title = 'Total: ';
			var totalTextSize = String(report.numTotal).length;

			charm.write(title);
			this._drawProgressBar(report, this.dimensions.width - title.length);
			charm.write(nodeUtil.format('\nPassed: %s  Failed: %s  Skipped: %d\n',
				fit(report.numPassed, totalTextSize), fit(report.numFailed, totalTextSize), report.numSkipped));
		},

		_Report: Report
	};

	return Pretty;
});
