import { resolve as resolvePath } from 'path';
import Collector = require('istanbul/lib/collector');
import CoberturaReporter = require('istanbul/lib/report/cobertura');
import { Reporter, ReporterKwArgs } from '../ReporterManager';
import { CoverageMap } from 'istanbul/lib/instrumenter';

export interface KwArgs extends ReporterKwArgs {
	projectRoot?: string;
}

export default class Cobertura implements Reporter {
	constructor(config: KwArgs = {}) {
		this._collector = new Collector();
		this._reporter = new CoberturaReporter({
			file: config.filename
		});

		if (config.projectRoot) {
			this._reporter.projectRoot = resolvePath(config.projectRoot);
		}
	}

	private _collector: Collector;
	private _reporter: CoberturaReporter;

	coverage(sessionId: string, coverage: CoverageMap) {
		this._collector.add(coverage);
	}

	runEnd() {
		this._reporter.writeReport(this._collector, true);
	}
}
