import Reporter, { createEventHandler, ReporterProperties } from './Reporter';
import { CoverageMap, CoverageMapData, createCoverageMap } from 'istanbul-lib-coverage';
import { createContext, summarizers, Watermarks } from 'istanbul-lib-report';
import { create, ReportType } from 'istanbul-reports';
import Node, { Events } from '../executors/Node';
export { ReportType };

const eventHandler = createEventHandler<Events>();

export default abstract class Coverage extends Reporter implements CoverageProperties {
	readonly reportType: ReportType = 'text';

	executor: Node;
	filename: string;
	watermarks: Watermarks;

	constructor(executor: Node, options: CoverageOptions = {}) {
		super(executor, options);

		if (options.filename) {
			this.filename = options.filename;
		}
		if (options.watermarks) {
			this.watermarks = options.watermarks;
		}
	}

	createCoverageReport(type: ReportType, data: CoverageMapData | CoverageMap) {
		let map: CoverageMap;

		if (isCoverageMap(data)) {
			map = data;
		}
		else {
			map = createCoverageMap(data);
		}

		const transformed = this.executor.sourceMapStore.transformCoverage(map);

		const context = createContext({
			sourceFinder: transformed.sourceFinder,
			watermarks: this.watermarks
		});
		const tree = summarizers.pkg(transformed.map);
		const report = create(type, { file: this.filename });
		tree.visit(report, context);
	}

	@eventHandler()
	runEnd(): void {
		this.createCoverageReport(this.reportType, this.executor.coverageMap);
	}
}

export interface CoverageProperties extends ReporterProperties {
	/** A filename to write coverage data to */
	filename?: string;

	/** Watermarks used to check coverage */
	watermarks?: Watermarks;
}

export type CoverageOptions = Partial<CoverageProperties>;

function isCoverageMap(value: any): value is CoverageMap {
	return value != null && typeof value.files === 'function';
}
