import Coverage, { ReportType } from './Coverage';

export default class HtmlCoverage extends Coverage {
	readonly reportType: ReportType = 'html';
}
