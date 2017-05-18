import Reporter, { ReporterProperties } from './Reporter';
import { CoverageMap, createCoverageMap } from 'istanbul-lib-coverage';
import { createContext, summarizers, Watermarks } from 'istanbul-lib-report';
import { readInitialCoverage } from 'istanbul-lib-instrument';
import { create, ReportType } from 'istanbul-reports';
import { createEventHandler } from './Reporter';
import { CoverageMessage } from '../executors/Executor';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import Node, { Events } from '../executors/Node';
import { expandFiles } from '../node/util';
import { mixin } from '@dojo/core/lang';

const eventHandler = createEventHandler<Events>();

export default abstract class Coverage<V extends CoverageOptions = CoverageOptions> extends Reporter<Node, CoverageOptions> implements CoverageProperties {
	readonly reportType: ReportType = 'text';

	executor: Node;

	filename: string;

	sources: string[];

	watermarks: Watermarks;

	_coverageMap: CoverageMap;

	constructor(executor: Node, config: V = <V>{}) {
		super(executor, mixin({}, {
			coverageFiles: <string[]>[]
		}, config));

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

		const transformed = this.executor.sourceMapStore.transformCoverage(map).map;

		const context = createContext();
		const tree = summarizers.pkg(transformed);
		tree.visit(create(type, {
			file: this.filename,
			watermarks: this.watermarks
		}), context);
	}

	@eventHandler()
	coverage(message: CoverageMessage): void {
		this._coverageMap.merge(message.coverage);
	}

	@eventHandler()
	runEnd(): void {
		const filesWithCoverage = this._coverageMap.files();
		expandFiles(this.sources)
			.map(path => resolve(path))
			.filter(path => filesWithCoverage.indexOf(path) === -1)
			.forEach(filename => {
				const code = readFileSync(filename, { encoding: 'utf8' });
				const instrumentedCode = this.executor.instrumentCode(code, filename);
				const coverage = readInitialCoverage(instrumentedCode);
				this._coverageMap.addFileCoverage(coverage.coverageData);
			});

		this.createCoverageReport(this.reportType, this._coverageMap);
	}
}

export interface CoverageProperties extends ReporterProperties {
	/** A filename to write coverage data to */
	filename: string | undefined;

	/**
	 * If set, all files in the coverage list will be added to the coverage report. This allows uncovered files to be
	 * noticed more easily.
	 */
	sources: string[] | undefined;

	/** Watermarks used to check coverage */
	watermarks: Watermarks | undefined;
}

export type CoverageOptions = Partial<CoverageProperties>;

function isCoverageMap(value: any): value is CoverageMap {
	return value != null && typeof value.files === 'function';
}
