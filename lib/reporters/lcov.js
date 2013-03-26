define([
	'dojo-ts/topic',
	'dojo-ts/node!istanbul/lib/collector',
	'dojo-ts/node!istanbul/lib/report/lcovonly'
], function (topic, Collector, Reporter) {
	var collector = new Collector(),
		reporter = new Reporter();

	topic.subscribe('/coverage', function (sessionId, coverage) {
		collector.add(coverage);
	});

	topic.subscribe('/runner/end', function () {
		reporter.writeReport(collector, true);
	});
});