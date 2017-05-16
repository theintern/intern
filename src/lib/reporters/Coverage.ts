import Reporter, { ReporterProperties } from './Reporter';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
import { createContext, summarizers, Watermarks } from 'istanbul-lib-report';
import { create, ReportType } from 'istanbul-reports';
import { createEventHandler } from './Reporter';
import { CoverageMessage } from '../executors/Executor';
import Node, { Events } from '../executors/Node';

const eventHandler = createEventHandler<Events>();

export default abstract class Coverage<V extends CoverageOptions = CoverageOptions> extends Reporter<Node, CoverageOptions> implements CoverageProperties {
	readonly reportType: ReportType = 'text';

	executor: Node;

	filename: string;

	watermarks: Watermarks;

	_coverageMap: CoverageMap;

	constructor(executor: Node, config: V = <V>{}) {
		super(executor, config);
		this._coverageMap = createCoverageMap();
	}

	createCoverageReport(type: ReportType, data: object | CoverageMap) {
		let map: CoverageMap;

		if (isCoverageMap(data)) {
			map = data;
		}
		else {
			map = createCoverageMap(data);
		}

		const transformed = this.executor.sourceMapStore.transformCoverage(map);

		const context = createContext();
		const tree = summarizers.pkg(transformed.map);
		tree.visit(create(type, {
			file: this.filename || null,
			watermarks: this.watermarks
		}), context);
	}

	@eventHandler()
	coverage(message: CoverageMessage): void {
		this._coverageMap.merge(message.coverage);
	}

	@eventHandler()
	runEnd(): void {
		this.createCoverageReport(this.reportType, this._coverageMap);
	}
}

export interface CoverageProperties extends ReporterProperties {
	filename: string;
	watermarks: Watermarks;
}

export type CoverageOptions = Partial<CoverageProperties>;

function isCoverageMap(value: any): value is CoverageMap {
	return value != null && typeof value.files === 'function';
}
