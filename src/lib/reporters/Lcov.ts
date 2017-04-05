import LcovOnlyReport = require('istanbul/lib/report/lcovonly');
import Coverage, { CoverageOptions } from './Coverage';

export default class Lcov extends Coverage {
	constructor(config: CoverageOptions = {}) {
		config.ReportClass = LcovOnlyReport;
		super(config);
	}

	coverage(_sessionId: string, coverage: Object): void {
		this.collector.add(coverage);
	}

	runEnd(): void {
		this.report.writeReport(this.collector, true);
	}
}
