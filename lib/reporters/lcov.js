define([
	'dojo-ts/node!istanbul/lib/collector',
	'dojo-ts/node!istanbul/lib/report/lcovonly'
], function (Collector, Reporter) {
	var collector = new Collector(),
		reporter = new Reporter();

	return {
		'/coverage': function (sessionId, coverage) {
			collector.add(coverage);
		},

		'/runner/end': function () {
			reporter.writeReport(collector, true);
		}
	};
});