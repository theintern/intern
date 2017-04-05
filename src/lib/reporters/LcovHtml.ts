import Collector = require('istanbul/lib/collector');
import HtmlReport = require('istanbul/lib/report/html');
import { Reporter, ReporterConfig } from '../../common';

export default class LcovHtmlReporter implements Reporter {
	private _collector: Collector;
	private _reporter: HtmlReport;

	constructor(config: ReporterConfig = {}) {
		this._collector = new Collector();
		this._reporter = new HtmlReport({
			dir: config.directory,
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
