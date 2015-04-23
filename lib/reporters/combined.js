/* jshint node:true */
define([
	'intern',
	'intern/lib/util',
	'dojo/node!fs',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/json',
	'dojo/node!istanbul/lib/report/html',
	'dojo/node!istanbul/lib/report/text',
	'dojo/node!istanbul/index'
], function (intern, util, fs, Collector, JsonReporter, LcovHtmlReporter, TextReporter) {
	var collector = new Collector();
	var reporters = [];

	if (intern.mode === 'client') {
		reporters = [ new JsonReporter() ];
	}
	else {
		reporters = [ new TextReporter(), new LcovHtmlReporter() ];
	}

	var hasDot = false;

	return {
		start: function () {
			console.log('Running ' + intern.mode + ' tests…');
		},

		'/suite/error': function (suite, error) {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.error(util.getErrorMessage(error));
		},

		'/session/start': function (remote) {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.log('Testing ' + remote.environmentType);
		},

		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		'/error': function (error) {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.error(util.getErrorMessage(error));
		},

		'/tunnel/start': function () {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.log('Starting tunnel');
		},

		'/tunnel/download/progress': function (tunnel, progress) {
			var total = progress.loaded / progress.total;

			if (isNaN(total)) {
				return;
			}

			hasDot && process.stdout.write('\n'), (hasDot = false);
			process.stdout.write('\rDownload ' + (total * 100).toFixed(2) + '% complete');

			if (total === 1) {
				process.stdout.write('\n');
			}
		},

		'/tunnel/status': function (tunnel, status) {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.log('Tunnel: ' + status);
		},

		'/test/pass': function () {
			if (intern.mode === 'runner') {
				process.stdout.write('.');
				hasDot = true;
			}
		},

		'/test/fail': function (test) {
			hasDot && process.stdout.write('\n'), (hasDot = false);
			console.error('FAIL: ' + test.id);
			console.error(util.getErrorMessage(test.error));
		},

		stop: function () {
			if (intern.mode === 'runner' && fs.existsSync('coverage-final.json')) {
				collector.add(JSON.parse(fs.readFileSync('coverage-final.json')));
			}

			hasDot && process.stdout.write('\n'), (hasDot = false);
			reporters.forEach(function (reporter) {
				reporter.writeReport(collector, true);
			});
		}
	};
});
