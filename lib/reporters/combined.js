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

	return {
		start: function () {
			console.log('Running ' + intern.mode + ' tests…');
		},

		'/session/start': function (remote) {
			console.log('Testing ' + remote.environmentType);
		},

		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		'/error': function (error) {
			util.logError(error);
		},

		'/tunnel/start': function () {
			console.log('Starting tunnel');
		},

		'/tunnel/download/progress': function (tunnel, progress) {
			console.log('Download ' + (progress.loaded / progress.total * 100) + '% complete');
		},

		'/tunnel/status': function (tunnel, status) {
			console.log('Tunnel: ' + status);
		},

		'/test/fail': function (test) {
			console.error('FAIL: ' + test.id);
			util.logError(test.error);
		},

		stop: function () {
			if (intern.mode === 'runner' && fs.existsSync('coverage-final.json')) {
				collector.add(JSON.parse(fs.readFileSync('coverage-final.json')));
			}

			reporters.forEach(function (reporter) {
				reporter.writeReport(collector, true);
			});
		}
	};
});
