import Executor from '../executors/Executor';
import Collector = require('istanbul/lib/collector');
import TextReport = require('istanbul/lib/report/text');
import Report = require('istanbul/lib/report');
import { Watermarks } from 'istanbul';
import Reporter, { ReporterProperties } from './Reporter';

export interface CoverageProperties extends ReporterProperties {
	filename: string;
	watermarks: Watermarks;
	ReportClass: ReportConstructor;
}

export interface ReportConstructor {
	new (config?: any): Report;
}

export type CoverageOptions = Partial<CoverageProperties>;

abstract class Coverage extends Reporter implements CoverageProperties {
	watermarks: Watermarks;

	filename: string;

	ReportClass: ReportConstructor;

	protected _report: Report;

	protected _collector: Collector;

	constructor(executor: Executor, options: CoverageOptions = {}) {
		super(executor, options);
	}

	get report() {
		if (!this._report) {
			this._report = new (this.ReportClass || TextReport)({
				file: this.filename,
				watermarks: this.watermarks
			});
		}
		return this._report;
	}

	get collector() {
		if (!this._collector) {
			this._collector = new Collector();
		}
		return this._collector;
	}
}

export default Coverage;
