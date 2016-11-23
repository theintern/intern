import Collector = require('dojo/node!istanbul/lib/collector');
import LcovOnlyReport = require('dojo/node!istanbul/lib/report/lcovonly');
import { Reporter, ReporterConfig } from '../../interfaces';

export class LcovReporter implements Reporter {
	/* private */ _collector: Collector;
	/* private */ _reporter: LcovOnlyReport;

	constructor(config: ReporterConfig = {}) {
		this._collector = new Collector();
		this._reporter = new LcovOnlyReport({
			file: config.filename,
			watermarks: config.watermarks
		});
	}

	coverage(sessionId: string, coverage: Object): void {
		this._collector.add(coverage);
	}

	runEnd(): void {
		this._reporter.writeReport(this._collector, true);
	}
}
