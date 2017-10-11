import BaseCoverage, { ReportType } from './BaseCoverage';

export default class LcovCoverage extends BaseCoverage {
	readonly reportType: ReportType = 'lcovonly';
}
