import { Reporter, ReporterKwArgs } from '../ReporterManager';
import Collector = require('istanbul/lib/collector');
import IstanbulReporter = require('istanbul/lib/report/lcovonly');
import { CoverageMap } from 'istanbul/lib/instrumenter';

export default class LcovReporter implements Reporter {
	private _collector: Collector;
	private _reporter: IstanbulReporter;

	constructor(config: ReporterKwArgs = {}) {
		this._collector = new Collector();
		this._reporter = new IstanbulReporter({
			file: config.filename
		});
	}

	coverage(sessionId: string, coverage: CoverageMap) {
		this._collector.add(coverage);
	}

	runEnd() {
		this._reporter.writeReport(this._collector, true);
	}
}
