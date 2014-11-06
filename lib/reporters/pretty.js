/**
 * Handles presentation of runner results to the user
 */
define([
	'intern/lib/args',
	'dojo/node!charm',
	'dojo/node!charm/lib/encode',
	'dojo/node!util',
	'intern/lib/util',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (args, Charm, encode, nodeUtil, internUtil, Collector, Reporter) {
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

	function getId(test) {
		var id = test.id;
		var reporter = pretty.reporters[test.sessionId];

		if (reporter) {
			id = id.replace(/^main/, String(reporter.type));
		}

		return id;
	}

	/**
	 * Render the progress bar
	 * [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 99/100
	 * @param report the report data to render
	 * @param width the maximum width for the entire progress bar
	 */
	function drawProgressBar(report, width) {
		var spinnerCharacter = SPINNER_STATES[pretty.spinnerOffset];
		var charm = pretty.charm;
		if (!report.numTotal) {
			charm.write('Pending');
			return;
		}

		var totalTextSize = String(report.numTotal).length;
		var remainingWidth = Math.max(width - 4 - (totalTextSize * 2), 1);
		var barSize = Math.min(remainingWidth, report.numTotal, pretty.options.maxProgressBarWidth);
		var results = report.getCompressedResults(barSize);

		charm.write('[' + results.map(function (value) {
			return pretty.options.colorReplacement[value];
		}).join(''));
		charm.display('reset').write(fit(spinnerCharacter, barSize - results.length) + '] ' +
			fit(report.finished, totalTextSize, true) + '/' + report.numTotal);
	}

	/**
	 * Render a single line
	 * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
	 * TODO split this into two lines. The first line will display the title, OS and code coverage and the progress \
	 *      bar on the second
	 */
	function drawReporter(report) {
		var charm = pretty.charm;
		var titleWidth = pretty.options.titleWidth;
		var leftOfBar = fit(abbreviateEnvironment(report.type).slice(0, titleWidth - 2) + ': ', titleWidth);
		var rightOfBar = '' +
			(report.numFailed ? ', ' + report.numFailed + ' fail' : '') +
			(report.numSkipped ? ', ' + report.numSkipped + ' skip' : '');
		var barWidth = pretty.dimensions.width - rightOfBar.length - titleWidth;

		charm.write(leftOfBar);
		drawProgressBar(report, barWidth);
		charm.write(rightOfBar + '\n');
	}

	/**
	 * Abbreviate the environment information for rendering
	 * @param env the test environment
	 * @returns {string} abbreviated environment information
	 */
	function abbreviateEnvironment(env) {
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
	}

	function drawTotalReporter(report) {
		var charm = pretty.charm;
		var title = 'Total: ';
		var totalTextSize = String(report.numTotal).length;

		charm.write(title);
		drawProgressBar(report, pretty.dimensions.width - title.length);
		charm.write(nodeUtil.format('\nPassed: %s  Failed: %s  Skipped: %d\n',
			fit(report.numPassed, totalTextSize), fit(report.numFailed, totalTextSize), report.numSkipped));
	}

	function render(omitLogs) {
		var charm = pretty.charm;
		var logLength = pretty.dimensions.height - pretty.sessions.length - 4 /* last line & total */ -
			(pretty.tunnelStatus ? 2 : 0) - (pretty.sessions.length ? 1 : 0) - (pretty.header ? 1 : 0);
		pretty.spinnerOffset = (++pretty.spinnerOffset) % SPINNER_STATES.length;

		charm.display('reset');
		pretty.header && charm.write(pretty.header + '\n');
		pretty.tunnelStatus && charm.write('Tunnel: ' + pretty.tunnelStatus + '\n\n');
		drawTotalReporter(pretty.total);

		// TODO if there is not room to render all reporters only render active ones or only the total with less space
		if (pretty.sessions.length) {
			charm.write('\n');
			pretty.sessions.forEach(function (sessionId) {
				drawReporter(pretty.reporters[sessionId]);
			});
		}

		if (!omitLogs && logLength > 0 && pretty.log.length) {
			var allowed = { '×': true, '⚠': true, '!': true };
			var logs = pretty.log.filter(function (line) {
				return allowed[line.charAt(0)];
			}).slice(-logLength).map(function (line) {
				// truncate long lines
				var color = pretty.options.colorReplacement[line.charAt(0)] || ASCII_COLOR.reset;
				line = line.split('\n', 1)[0];
				return color + line.slice(0, pretty.dimensions.width) + ASCII_COLOR.reset;
			}).join('\n');
			charm.write('\n');
			charm.write(logs);
		}
	}

	var pretty = {
		options: {
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
		},
		spinnerOffset: 0,
		charm: null,
		dimensions: {},
		header: '',
		tunnelStatus: '',
		total: new Report(),
		reporters: {},
		sessions: [],
		log: [],
		_renderTimeout: undefined,

		_Report: Report,
		_render: render,

		start: function () {
			pretty.header = args.config;
			pretty.charm = pretty.charm || new Charm();
			pretty.charm.pipe(process.stdout);

			function resize() {
				pretty.dimensions.width = process.stdout.columns || 80;
				pretty.dimensions.height = process.stdout.rows || 24;
			}
			resize();
			process.stdout.on('resize', resize);

			(function rerender() {
				pretty.charm.erase('screen').position(0, 0);
				render();
				pretty._renderTimeout = setTimeout(rerender, 200);
			})();
		},
		stop: function () {
			var charm = pretty.charm;
			clearTimeout(pretty._renderTimeout);
			charm.erase('screen').position(0, 0);

			// write a full log of errors
			// Sort logs: pass < deprecated < skip < errors < fail
			var ERROR_LOG_WEIGHT = { '!': 4, '×': 3, '~': 2, '⚠': 1, '✓': 0 };
			var logs = this.log.sort(function (a, b) {
				a = ERROR_LOG_WEIGHT[a.charAt(0)] || 0;
				b = ERROR_LOG_WEIGHT[b.charAt(0)] || 0;
				return a - b;
			}).map(function (line) {
				var color = pretty.options.colorReplacement[line.charAt(0)];
				return color + line;
			}).join('\n');
			charm.write(logs);
			charm.write('\n\n');

			// Display the pretty results
			render(true);

			// Display coverage information
			charm.write('\n');
			(new Reporter()).writeReport(pretty.total.coverage, true);
		},

		'/session/start': function (remote) {
			pretty.reporters[remote.sessionId] = new Report(remote.environmentType);
			pretty.sessions.push(remote.sessionId);
		},

		'/coverage': function (sessionId, coverage) {
			var reporter = pretty.reporters[sessionId];
			reporter && reporter.coverage.add(coverage);
			pretty.total.coverage.add(coverage);
		},

		'/suite/start': function (suite) {
			if (suite.name === 'main' && !suite.parent) {
				var reporter = pretty.reporters[suite.sessionId];
				var numTests = suite.numTests;
				reporter && (reporter.numTotal += numTests);
				pretty.total.numTotal += numTests;
			}
		},

		'/test/skip': function (test) {
			pretty._record(test.sessionId, SKIP);
			pretty.log.push('~ ' + getId(test) + ': ' + test.skipped);
		},
		'/test/pass': function (test) {
			pretty._record(test.sessionId, PASS);
			pretty.log.push('✓ ' + getId(test));
		},
		'/test/fail': function (test) {
			var message = '× ' + getId(test);
			pretty._record(test.sessionId, FAIL);
			pretty.log.push(message + '\n' + internUtil.getErrorMessage(test.error));
		},

		'/tunnel/start': function () {
			pretty.tunnelStatus = 'Starting';
		},
		'/tunnel/download/progress': function (tunnel, progress) {
			pretty.tunnelStatus = 'Downloading ' + (progress.received / progress.numTotal * 100).toFixed(2) + '%';
		},
		'/tunnel/status': function (tunnel, status) {
			pretty.tunnelStatus = status;
		},

		'/runner/start': function () {
			pretty.tunnelStatus = 'Ready';
		},

		'/error': function (error) {
			var message = '! ' + error.message;
			pretty.log.push(message);
		},

		'/deprecated': function (name, replacement) {
			var message = '⚠ ' + name + ' is deprecated. Use ' + replacement + ' instead.';
			pretty.log.push(message);
		},

		_record: function (sessionId, result) {
			var reporter = pretty.reporters[sessionId];
			reporter && reporter.record(result);
			pretty.total.record(result);
		}
	};

	return pretty;
});
