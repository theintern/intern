import BaseCoverage, {
	ReportType, BaseCoverageProperties
} from './BaseCoverage';
import Node from '../executors/Node';

export default class Coverage extends BaseCoverage
	implements CoverageProperties {

	readonly reportType: ReportType = 'text';
	maxColumns: number;

	constructor(executor: Node, options: CoverageOptions = {}) {
		super(executor, options);

		if (options.maxColumns) {
			this.maxColumns = options.maxColumns;
		}
	}

	getReporterOptions(): { [key: string]: any; } {
		const options = super.getReporterOptions();

		options.maxColumns = this.maxColumns;

		return options;
	}
}

export interface CoverageProperties extends BaseCoverageProperties {
	/** Maximum number of columns */
	maxColumns: number;
}

export type CoverageOptions = Partial<CoverageProperties>;
