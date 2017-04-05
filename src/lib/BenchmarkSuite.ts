import Suite, { SuiteOptions, SuiteProperties, TestLifecycleFunction } from './Suite';
import BenchmarkTest from './BenchmarkTest';

export default class BenchmarkSuite extends Suite implements BenchmarkSuiteProperties {
	/** A function that is run after each test call by benchmark.js */
	afterEachLoop: TestLifecycleFunction;

	/** A function that is run before each test call by benchmark.js */
	beforeEachLoop: TestLifecycleFunction;

	tests: (BenchmarkSuite | BenchmarkTest)[];

	constructor(options: BenchmarkSuiteOptions) {
		super(<SuiteOptions>options);
	}
}

export interface BenchmarkSuiteProperties extends SuiteProperties {
	beforeEachLoop: TestLifecycleFunction;
	afterEachLoop: TestLifecycleFunction;
}

export type BenchmarkSuiteOptions = Partial<BenchmarkSuiteProperties> & {
	name: string;
	tests?: (BenchmarkSuite | BenchmarkTest)[];
};
