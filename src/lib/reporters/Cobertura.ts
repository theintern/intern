import Coverage, { ReportType, CoverageProperties } from './Coverage';
import Node from '../executors/Node';

export default class Cobertura extends Coverage
  implements CoberturaCoverageProperties {
  readonly reportType: ReportType = 'cobertura';
  projectRoot: string | undefined;

  constructor(executor: Node, options: CoberturaCoverageOptions = {}) {
    super(executor, options);

    if (options.projectRoot) {
      this.projectRoot = options.projectRoot;
    }
  }

  getReporterOptions(): { [key: string]: any } {
    const options = super.getReporterOptions();

    options.projectRoot = this.projectRoot;

    return options;
  }
}

export interface CoberturaCoverageProperties extends CoverageProperties {
  projectRoot?: string;
}

export type CoberturaCoverageOptions = Partial<CoberturaCoverageProperties>;
