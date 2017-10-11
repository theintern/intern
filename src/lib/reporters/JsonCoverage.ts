import BaseCoverage, { ReportType } from './BaseCoverage';

export default class JsonCoverage extends BaseCoverage {
	readonly reportType: ReportType = 'json';
}
