import BaseCoverage, {
	ReportType, BaseCoverageProperties
} from './BaseCoverage';
import Node from '../executors/Node';

export default class HtmlCoverage extends BaseCoverage
	implements HtmlCoverageProperties {

	readonly reportType: ReportType = 'html';
	verbose: boolean;

	constructor(executor: Node, options: HtmlCoverageOptions = {}) {
		super(executor, options);

		if ('verbose' in options) {
			this.verbose = options.verbose!;
		}
	}

	getReporterOptions(): { [key: string]: any; } {
		const options = super.getReporterOptions();

		options.verbose = this.verbose;

		return options;
	}
}

export interface HtmlCoverageProperties extends BaseCoverageProperties {
	verbose: boolean;
}

export type HtmlCoverageOptions = Partial<HtmlCoverageProperties>;
