import {
  CoverageMap,
  CoverageMapData,
  createCoverageMap
} from 'istanbul-lib-coverage';
import { createContext, Watermarks } from 'istanbul-lib-report';
import { create, ReportType } from 'istanbul-reports';
import Reporter, { createEventHandler, ReporterProperties } from './Reporter';
import Node, { NodeEvents } from '../executors/Node';

export { ReportType };

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

  getReporterOptions(): { [key: string]: any } {
    return {
      file: this.filename
    };
  }

  async createCoverageReport(
    type: ReportType,
    data: CoverageMapData | CoverageMap
  ) {
    let map: CoverageMap;

    if (isCoverageMap(data)) {
      map = data;
    } else {
      map = createCoverageMap(data);
    }

    const mapStore = (this.executor.sourceMapStore as unknown) as AsyncMapStore;

    const transformed = await mapStore.transformCoverage(map);

    const context = createContext({
      dir: this.directory,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      sourceFinder: mapStore.sourceFinder,
      watermarks: this.watermarks,
      coverageMap: transformed
    });
    const tree = context.getTree('pkg');
    const report = create(type, this.getReporterOptions());
    tree.visit(report, context);
  }

  @eventHandler()
  runEnd() {
    const map = this.executor.coverageMap;
    if (map.files().length > 0) {
      this.createCoverageReport(this.reportType, map).catch(error => {
        this.executor.emit('error', error);
      });
    }
  }
}

export interface CoverageProperties extends ReporterProperties {
  /** A filename to write coverage data to */
  filename?: string;

  /** A direcotry to write coverage data to */
  directory?: string;

  /** Watermarks used to check coverage */
  watermarks?: Watermarks;
}

export type CoverageOptions = Partial<CoverageProperties>;

function isCoverageMap(value: any): value is CoverageMap {
  return value != null && typeof value.files === 'function';
}

/**
 * This is needed since the typings for istanbul-lib-source-maps are out of
 * date.
 *
 * TODO: remove this when @types/istanbul-lib-source-maps is updated to >= 3.
 */
interface AsyncMapStore {
  transformCoverage(coverageMap: CoverageMap): Promise<CoverageMap>;
  sourceFinder(path: string): string;
}
