import BaseCoverage, {
	ReportType, BaseCoverageProperties
} from './BaseCoverage';
import Node from '../executors/Node';

export default class Cobertura extends BaseCoverage
	implements CoberturaCoverageProperties {

	readonly reportType: ReportType = 'cobertura';
	projectRoot: string;

	constructor(executor: Node, options: CoberturaCoverageOptions = {}) {
		super(executor, options);

		if (options.projectRoot) {
			this.projectRoot = options.projectRoot;
		}
	}

	getReporterOptions(): { [key: string]: any; } {
		const options = super.getReporterOptions();

		options.projectRoot = this.projectRoot;

		return options;
	}
}

export interface CoberturaCoverageProperties extends BaseCoverageProperties {
	projectRoot?: string;
}

export type CoberturaCoverageOptions = Partial<CoberturaCoverageProperties>;
