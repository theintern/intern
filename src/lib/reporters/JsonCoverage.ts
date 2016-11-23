import Collector = require('dojo/node!istanbul/lib/collector');
import JsonReporter = require('dojo/node!istanbul/lib/report/json');
import { Reporter, ReporterConfig } from '../../common';

export default class JsonCoverage implements Reporter {
	_collector: Collector;
	_reporter: JsonReporter;

	constructor(config: ReporterConfig = {}) {
		config = config || {};

		this._collector = new Collector();
		this._reporter = new JsonReporter({
			file: config.filename,
			watermarks: config.watermarks
		});
	}

	coverage(_sessionId: string, coverage: Object): void {
		this._collector.add(coverage);
	}

	runEnd(): void {
		this._reporter.writeReport(this._collector, true);
	}
}
