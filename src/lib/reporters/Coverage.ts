import {
  CoverageMap,
  CoverageMapData,
  createCoverageMap
} from 'istanbul-lib-coverage';
import { createContext, summarizers, Watermarks } from 'istanbul-lib-report';
import { create, ReportType } from 'istanbul-reports';
import Reporter, { createEventHandler, ReporterProperties } from './Reporter';
import Node, { NodeEvents } from '../executors/Node';

export { ReportType };

export interface CoverageProperties extends ReporterProperties {
  /** A filename provided to the coverage reporter */
  filename?: string;

  /** A directory provided to the coverage reporter */
  directory?: string;

  /** Watermarks used to check coverage */
  watermarks?: Watermarks;
}

export type CoverageOptions = Partial<CoverageProperties>;

const eventHandler = createEventHandler<NodeEvents>();

export default abstract class Coverage extends Reporter
  implements CoverageProperties {
  abstract readonly reportType: ReportType;
  readonly executor!: Node;

  filename?: string;
  directory?: string;
  watermarks?: Watermarks;

  constructor(executor: Node, options: CoverageOptions = {}) {
    super(executor, options);

    if (options.filename) {
      this.filename = options.filename;
    }
    if (options.directory) {
      this.directory = options.directory;
    }
    if (options.watermarks) {
      this.watermarks = options.watermarks;
    }
  }

  /**
   * This is a bag of data provided to the selected istanbul reporter (defined by `reportType`).
   * by default this provides a filename (if present), though not all reporters use a filename.
   */
  getReporterOptions(): { [key: string]: any } {
    return {
      file: this.filename
    };
  }

  createCoverageReport(type: ReportType, data: CoverageMapData | CoverageMap) {
    let map: CoverageMap;

    if (isCoverageMap(data)) {
      map = data;
    } else {
      map = createCoverageMap(data);
    }

    const transformed = this.executor.sourceMapStore.transformCoverage(map);

    // context is a bag of data used by the report. Values will not necessarily be used (it depends on the specific reporter)
    const context = createContext({
      dir: this.directory,
      sourceFinder: transformed.sourceFinder,
      watermarks: this.watermarks
    });
    const tree = summarizers.pkg(transformed.map);
    const report = create(type, this.getReporterOptions());
    tree.visit(report, context);
  }

  @eventHandler()
  runEnd(): void {
    const map = this.executor.coverageMap;
    if (map.files().length > 0) {
      this.createCoverageReport(this.reportType, map);
    }
  }
}

function isCoverageMap(value: any): value is CoverageMap {
  return value != null && typeof value.files === 'function';
}
