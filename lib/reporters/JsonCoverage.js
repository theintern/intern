define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/json'
], function (Collector, Reporter) {
	function JsonCoverageReporter(config) {
		config = config || {};

		this._collector = new Collector();
		this._reporter = new Reporter({
			file: config.filename,
			watermarks: config.watermarks
		});
	}

	JsonCoverageReporter.prototype.coverage = function (sessionId, coverage) {
		this._collector.add(coverage);
	};

	JsonCoverageReporter.prototype.runEnd = function () {
		this._reporter.writeReport(this._collector, true);
	};

	return JsonCoverageReporter;
});
