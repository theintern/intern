import Coverage, { ReportType, CoverageProperties } from './Coverage';
import Node from '../executors/Node';

export default class HtmlCoverage extends Coverage
  implements HtmlCoverageProperties {
  readonly reportType: ReportType = 'html';
  verbose: boolean | undefined;

  constructor(executor: Node, options: HtmlCoverageOptions = {}) {
    super(executor, options);

    if ('verbose' in options) {
      this.verbose = options.verbose!;
    }
  }

  getReporterOptions(): { [key: string]: any } {
    const options = super.getReporterOptions();

    options.verbose = this.verbose;

    return options;
  }
}

export interface HtmlCoverageProperties extends CoverageProperties {
  verbose: boolean | undefined;
}

export type HtmlCoverageOptions = Partial<HtmlCoverageProperties>;
