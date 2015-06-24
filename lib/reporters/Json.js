define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/json'
], function (Collector, Reporter) {
	function JsonReporter(config) {
		config = config || {};

		this._collector = new Collector();
		this._reporter = new Reporter({
			dir: config.directory,
			watermarks: config.watermarks
		});
	}

	JsonReporter.prototype.coverage = function (sessionId, coverage) {
		this._collector.add(coverage);
	};

	JsonReporter.prototype.runEnd = function () {
		this._reporter.writeReport(this._collector, true);
	};

	return JsonReporter;
});
