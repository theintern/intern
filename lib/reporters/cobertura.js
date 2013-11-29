define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/cobertura'
], function (Collector, Reporter) {
	var collector = new Collector(),
		reporter = new Reporter();

	return {
		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		stop: function () {
			reporter.writeReport(collector, true);
		}
	};
});
