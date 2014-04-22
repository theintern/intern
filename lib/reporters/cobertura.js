define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/cobertura'
], function (Collector, Reporter) {
	var collector, reporter;

	return {
		
		start: function (config) {
			collector = new Collector(config);
			reporter = new Reporter(config);
		},
		
		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		stop: function () {
			reporter.writeReport(collector, true);
		}
	};
});
