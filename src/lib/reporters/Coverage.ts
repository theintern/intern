import Reporter, { createEventHandler, ReporterProperties } from './Reporter';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
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

	createCoverageReport(type: ReportType, data: object | CoverageMap) {
		let map: CoverageMap;

		if (isCoverageMap(data)) {
			map = data;
		}
		else {
			map = createCoverageMap(data);
		}

		const transformed = this.executor.sourceMapStore.transformCoverage(map).map;

		const context = createContext();
		const tree = summarizers.pkg(transformed);
		tree.visit(create(type, {
			file: this.filename,
			watermarks: this.watermarks
		}), context);
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
