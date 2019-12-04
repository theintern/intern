import Coverage, { ReportType, CoverageProperties } from './Coverage';
import Node from '../executors/Node';

export default class TextCoverage extends Coverage
  implements TextCoverageProperties {
  readonly reportType: ReportType = 'text';
  maxColumns: number | undefined;

  constructor(executor: Node, options: TextCoverageOptions = {}) {
    super(executor, options);

    if (options.maxColumns) {
      this.maxColumns = options.maxColumns;
    }
  }

  getReporterOptions(): { [key: string]: any } {
    const options = super.getReporterOptions();

    options.maxColumns = this.maxColumns;

    return options;
  }
}

export interface TextCoverageProperties extends CoverageProperties {
  /** Maximum number of columns */
  maxColumns?: number;
}

export type TextCoverageOptions = Partial<TextCoverageProperties>;
