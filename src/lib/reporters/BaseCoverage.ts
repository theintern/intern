import {
	CoverageMap,
	CoverageMapData,
	createCoverageMap
} from 'istanbul-lib-coverage';
import { createContext, summarizers, Watermarks } from 'istanbul-lib-report';
import { create, ReportType } from 'istanbul-reports';
import Reporter, { createEventHandler, ReporterProperties } from './Reporter';
import Node, { Events } from '../executors/Node';

export { ReportType };

const eventHandler = createEventHandler<Events>();

export default abstract class BaseCoverage extends Reporter
	implements BaseCoverageProperties {

	abstract readonly reportType: ReportType;

	executor: Node;
	filename: string;
	directory: string;
	watermarks: Watermarks;

	constructor(executor: Node, options: BaseCoverageOptions = {}) {
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

	getReporterOptions(): { [key: string]: any; } {
		return {
			file: this.filename
		};
	}

	createCoverageReport(
		type: ReportType,
		data: CoverageMapData | CoverageMap
	) {
		let map: CoverageMap;

		if (isCoverageMap(data)) {
			map = data;
		} else {
			map = createCoverageMap(data);
		}

		const transformed = this.executor.sourceMapStore.transformCoverage(map);

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

export interface BaseCoverageProperties extends ReporterProperties {
	/** A filename to write coverage data to */
	filename?: string;

	/** A direcotry to write coverage data to */
	directory?: string;

	/** Watermarks used to check coverage */
	watermarks?: Watermarks;
}

export type BaseCoverageOptions = Partial<BaseCoverageProperties>;

function isCoverageMap(value: any): value is CoverageMap {
	return value != null && typeof value.files === 'function';
}
