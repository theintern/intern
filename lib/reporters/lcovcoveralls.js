define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/lcovonly'
], function (Collector, Reporter) {
	var collector = new Collector(),
		reporter = new Reporter(),
		internConfig;

	return {
		'/proxy/start': function (config) {
			internConfig = config;
		},

		'/coverage': function (sessionId, coverage) {
			var filenames = Object.keys(coverage);
			filenames.forEach(function(filename) {
				coverage[filename].path = coverage[filename].path.replace(internConfig.basePath, '');
			});
			collector.add(coverage);
		},

		stop: function () {
			reporter.writeReport(collector, true);
		}
	};
});
