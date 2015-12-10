import { Reporter, ReporterKwArgs } from '../ReporterManager';
import Collector = require('istanbul/lib/collector');
import IstanbulReporter = require('istanbul/lib/report/html');
import { Coverage } from 'istanbul/lib/instrumenter';

export interface KwArgs extends ReporterKwArgs {
	directory?: string;
}

export default class LcovHtmlReporter implements Reporter {
	private _collector: Collector;
	private _reporter: IstanbulReporter;

	constructor(config: KwArgs = {}) {
		this._collector = new Collector();
		this._reporter = new IstanbulReporter({
			dir: config.directory,
			watermarks: config.watermarks
		});
	}

	coverage(sessionId: string, coverage: Coverage) {
		this._collector.add(coverage);
	}

	runEnd() {
		this._reporter.writeReport(this._collector, true);
	}
}
