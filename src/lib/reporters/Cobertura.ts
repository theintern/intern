import { resolve } from 'path';
import Collector = require('istanbul/lib/collector');
import CoberturaReport = require('istanbul/lib/report/cobertura');
import { Reporter, ReporterConfig } from '../../common';

export default class Cobertura implements Reporter {
	private _collector: Collector;
	private _reporter: CoberturaReport;

	constructor(config: ReporterConfig) {
		this._collector = new Collector();
		this._reporter = new CoberturaReport({
			file: config.filename,
			watermarks: config.watermarks
		});

		if (config.projectRoot) {
			this._reporter.projectRoot = resolve(config.projectRoot);
		}
	}

	coverage(_sessionId: string, coverage: Object): void {
		this._collector.add(coverage);
	}

	runEnd() {
		this._reporter.writeReport(this._collector, true);
	}
}
