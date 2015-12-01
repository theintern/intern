define([
	'dojo/node!path',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/cobertura'
], function (pathUtil, Collector, Reporter) {
	function Cobertura(config) {
		config = config || {};

		this._collector = new Collector();
		this._reporter = new Reporter({
			file: config.filename,
			watermarks: config.watermarks
		});

		if (config.projectRoot) {
			this._reporter.projectRoot = pathUtil.resolve(config.projectRoot);
		}
	}

	Cobertura.prototype.coverage = function (sessionId, coverage) {
		this._collector.add(coverage);
	};

	Cobertura.prototype.runEnd = function () {
		this._reporter.writeReport(this._collector, true);
	};

	return Cobertura;
});
