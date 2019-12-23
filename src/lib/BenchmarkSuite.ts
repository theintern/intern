import Suite, {
  SuiteOptions,
  SuiteProperties,
  TestLifecycleFunction
} from './Suite';
import BenchmarkTest from './BenchmarkTest';

/**
 * BenchmarkSuite is a specialization of [[lib/Suite]] that manages
 * [[lib/BenchmarkTest|BenchmarkTests]].
 */
export default class BenchmarkSuite extends Suite
  implements BenchmarkSuiteProperties {
  /** A function that is run after each test call by benchmark.js */
  afterEachLoop: TestLifecycleFunction | undefined;

  /** A function that is run before each test call by benchmark.js */
  beforeEachLoop: TestLifecycleFunction | undefined;

  tests!: (BenchmarkSuite | BenchmarkTest)[];

  constructor(options: BenchmarkSuiteOptions) {
    super(<SuiteOptions>options);
  }
}

export interface BenchmarkSuiteProperties extends SuiteProperties {
  beforeEachLoop: TestLifecycleFunction | undefined;
  afterEachLoop: TestLifecycleFunction | undefined;
}

export type BenchmarkSuiteOptions = Partial<BenchmarkSuiteProperties> & {
  name: string;
  parent: Suite;
  tests?: (BenchmarkSuite | BenchmarkTest)[];
};
