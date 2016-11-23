import Collector = require('dojo/node!istanbul/lib/collector');
import HtmlReport = require('dojo/node!istanbul/lib/report/html');
import { Reporter, ReporterConfig } from '../../interfaces';

export class LcovHtmlReporter implements Reporter {
	private _collector: Collector;
	private _reporter: HtmlReport;

	constructor(config: ReporterConfig = {}) {
		this._collector = new Collector();
		this._reporter = new HtmlReport({
			dir: config.directory,
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
