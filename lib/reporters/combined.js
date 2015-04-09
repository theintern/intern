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

	if (intern.executor.mode === 'client') {
		reporters = [ new JsonReporter() ];
	}
	else {
		reporters = [ new TextReporter(), new LcovHtmlReporter() ];
	}

	return {
		start: function () {
			console.log('Running ' + intern.executor.mode + ' tests…');
		},

		'/session/start': function (remote) {
			console.log('Testing ' + remote.environmentType);
		},

		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		'/error': function (error) {
			console.error(util.getErrorMessage(error));
		},

		'/tunnel/start': function () {
			console.log('Starting tunnel');
		},

		'/tunnel/download/progress': function (tunnel, progress) {
			var total = progress.loaded / progress.total;

			if (isNaN(total)) {
				return;
			}

			process.stdout.write('\x1b[99DDownload ' + (total * 100).toFixed(2) + '% complete');

			if (total === 1) {
				process.stdout.write('\n');
			}
		},

		'/tunnel/status': function (tunnel, status) {
			console.log('Tunnel: ' + status);
		},

		'/test/fail': function (test) {
			console.error('FAIL: ' + test.id);
			console.error(util.getErrorMessage(test.error));
		},

		stop: function () {
			console.log('stopped');
			if (intern.executor.mode === 'runner' && fs.existsSync('coverage-final.json')) {
				collector.add(JSON.parse(fs.readFileSync('coverage-final.json')));
			}

			reporters.forEach(function (reporter) {
				console.log('writing report');
				reporter.writeReport(collector, true);
			});
		}
	};
});
