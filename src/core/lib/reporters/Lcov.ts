import Coverage, { ReportType } from './Coverage';

export default class LcovCoverage extends Coverage {
  readonly reportType: ReportType = 'lcovonly';
}
