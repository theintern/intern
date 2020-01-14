import Coverage, { ReportType } from './Coverage';

export default class JsonCoverage extends Coverage {
  readonly reportType: ReportType = 'json';
}
