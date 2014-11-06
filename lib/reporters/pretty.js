/**
 * Handles presentation of runner results to the user
 */
define([
	'intern/lib/args',
	'dojo/node!charm',
	'dojo/node!util',
	'intern/lib/util',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (args, Charm, nodeUtil, internUtil, Collector, Reporter) {
	/* globals process */

	var PAD = '                                                                                                       ';
	var PASS = 0;
	var SKIP = 1;
	var FAIL = 2;
	var BROWSERS = {
		chrome: 'Chr ',
		firefox: 'Fx  ',
		opera: 'O   ',
		safari: 'Saf ',
		'internet explorer': 'IE  ',
		phantomjs: 'Phan'
	};
	var charRender = {
		0: function () {
			pretty.charm.foreground('green').write('✓');
		},
		1: function () {
			pretty.charm.display('reset').write('~');
		},
		2: function () {
			pretty.charm.foreground('red').write('×');
		}
	};

	/**
	 * Model tracking test results
	 * @param type the environment or string describing this report
	 * @constructor
	 */
	function Report(type) {
		this.type = type || '';
		this.total = 0;
		this.passed = 0;
		this.failed = 0;
		this.skipped = 0;
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
				this.passed++;
				break;
			case SKIP:
				this.skipped++;
				break;
			case FAIL:
				this.failed++;
				break;
			}
		},

		getCompressedResults: function (max) {
			var total = Math.max(this.total, this.results.length);
			var width = Math.min(max, total);
			var resultList = [];

			for (var i = 0; i < this.results.length; i++) {
				var pos = Math.floor(i / total * width);
				resultList[pos] = Math.max(resultList[pos] || PASS, this.results[i]);
			}

			return resultList;
		}
	};

	function pad(width) {
		return PAD.substr(0, Math.max(width, 0));
	}

	function fit(str, width, padLeft) {
		str = '' + str;
		if (str.length < width) {
			if (padLeft) {
				return pad(width - str.length) + str;
			}
			return str + pad(width - str.length);
		}
		return str.substr(0, width);
	}

	/**
	 * Render the progress bar
	 * [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 99/100
	 * @param report the report data to render
	 * @param width the maximum width for the entire progress bar
	 */
	function drawProgressBar(report, width) {
		var charm = pretty.charm;
		if (!report.total) {
			charm.write('Pending');
			return;
		}

		var totalStrLen = String(report.total).length;
		var barSize = Math.min(Math.max(width - 4 - (totalStrLen * 2), 1), report.total);
		var results = report.getCompressedResults(barSize);

		charm.write('[');
		results.forEach(function (value) {
			charRender[value]();
		});
		charm.display('reset').write(pad(barSize - results.length) + '] ' +
			fit(report.finished, totalStrLen, true) + '/' + report.total);
	}

	/**
	 * Render a single line
	 * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
	 */
	function drawReporter(report) {
		var charm = pretty.charm;
		var leftOfBar = fit(abbreviateEnvironment(report.type, pretty.titleWidth) + ': ', pretty.titleWidth);
		var rightOfBar = '' +
			(report.failed ? ', ' + report.failed + ' fail' : '') +
			(report.skipped ? ', ' + report.skipped + ' skip' : '');
		var barWidth = pretty.dimensions.width - rightOfBar.length - pretty.titleWidth;

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

		if (env.version) {
			var version = String(env.version);
			if (version.indexOf('.') > -1) {
				version = version.slice(0, version.indexOf('.'));
			}
			return browser + version;
		}

		return browser;
	}

	function drawTotalReporter(report) {
		var charm = pretty.charm;
		var title = 'Total: ';
		var totalStrLen = String(report.total).length;

		charm.write(title);
		drawProgressBar(report, pretty.dimensions.width - title.length);
		charm.write(nodeUtil.format('\nPassed: %s  Failed: %s  Skipped: %d\n',
			fit(report.passed, totalStrLen), fit(report.failed, totalStrLen), report.skipped));
	}

	function render(omitLogs) {
		var charm = pretty.charm;
		var logLength = pretty.dimensions.height - pretty.sessions.length - 4 /* last line & total */ -
			(pretty.tunnelStatus ? 2 : 0) - (pretty.sessions.length ? 1 : 0) - (pretty.header ? 1 : 0);

		charm.erase('screen');
		charm.position(0, 0);

		pretty.header && charm.write(pretty.header + '\n');
		pretty.tunnelStatus && charm.write('Tunnel: ' + pretty.tunnelStatus + '\n\n');
		drawTotalReporter(pretty.total);

		if (pretty.sessions.length) {
			charm.write('\n');
			pretty.sessions.forEach(function (sessionId) {
				drawReporter(pretty.reporters[sessionId]);
			});
		}

		if (!omitLogs && logLength > 0 && pretty.log.length) {
			var logs = pretty.log.slice(-logLength).join('\n').split('\n').slice(-logLength);
			charm.write('\n');
			charm.write(logs.join('\n'));
		}
	}

	var pretty = {
		charm: null,
		dimensions: {
			width: 80,
			height: 24
		},
		titleWidth: 10,
		header: '',
		tunnelStatus: '',
		total: new Report(),
		reporters: {},
		sessions: [],
		log: [],
		_renderTimeout: undefined,
		_charRender: charRender,

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
				render();
				pretty._renderTimeout = setTimeout(rerender, 200);
			})();
		},
		stop: function () {
			clearTimeout(pretty._renderTimeout);
			// Display the pretty results
			render(true);

			// Display coverage information
			(new Reporter()).writeReport(pretty.total.coverage, true);

			// write a full log of errors
			this.log.sort();
			pretty.charm.write(this.log.join('\n'));
			pretty.charm.write('\n');
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
				reporter && (reporter.total += numTests);
				pretty.total.total += numTests;
			}
		},

		'/test/skip': function (test) {
			pretty._record(test.sessionId, SKIP);
			pretty.log.push('~ ' + test.id + ': ' + test.skipped);
		},
		'/test/pass': function (test) {
			pretty._record(test.sessionId, PASS);
			pretty.log.push('✓ ' + test.id);
		},
		'/test/fail': function (test) {
			pretty._record(test.sessionId, FAIL);
			pretty.log.push('× ' + test.id + '\n' + internUtil.getErrorMessage(test.error));
		},

		'/tunnel/start': function () {
			pretty.tunnelStatus = 'Starting';
		},
		'/tunnel/download/progress': function (tunnel, progress) {
			pretty.tunnelStatus = 'Downloading ' + (progress.received / progress.total * 100).toFixed(2) + '%';
		},
		'/tunnel/status': function (tunnel, status) {
			pretty.tunnelStatus = status;
		},

		'/error': function (error) {
			pretty.log.push('! ' + error.message);
		},
		
		'/deprecated': function (name, replacement) {
			pretty.log.push('⚠ ' + name + ' is deprecated. Use ' + replacement + ' instead.');
		},

		_record: function (sessionId, result) {
			var reporter = pretty.reporters[sessionId];
			reporter && reporter.record(result);
			pretty.total.record(result);
		}
	};

	return pretty;
});
