import Coverage, { ReportType } from './Coverage';

export default class Cobertura extends Coverage {
	readonly reportType: ReportType = 'cobertura';
}
