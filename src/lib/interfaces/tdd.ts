import { on } from '@dojo/core/aspect';
import Suite, { SuiteLifecycleFunction } from '../Suite';
import Test, { TestFunction } from '../Test';
import Executor from '../executors/Executor';

export interface TddInterface {
	suite(name: string, factory: SuiteLifecycleFunction): void;
	test(name: string, test: TestFunction): void;
	before(fn: SuiteLifecycleFunction): void;
	after(fn: SuiteLifecycleFunction): void;
	beforeEach(fn: SuiteLifecycleFunction): void;
	afterEach(fn: SuiteLifecycleFunction): void;
}

export default function getInterface(executor: Executor): TddInterface {
	let currentSuite: Suite;

	return {
		suite(name: string, factory: (suite: Suite) => void) {
			const parent = currentSuite;
			const suite = new Suite({ name });
			if (!parent) {
				// This is a new top-level suite, not a nested suite
				executor.addTest(suite);
			}
			else {
				parent.add(suite);
			}
			currentSuite = suite;
			factory.call(suite, suite);
			currentSuite = parent;
		},

		test(name: string, test: TestFunction) {
			if (!currentSuite) {
				throw new Error('A test must be declared within a suite');
			}
			currentSuite.add(new Test({ name, test, parent: currentSuite }));
		},

		before(fn: SuiteLifecycleFunction) {
			if (!currentSuite) {
				throw new Error(`A suite lifecycle method must be declared within a suite`);
			}
			on(currentSuite, 'before', fn);
		},

		after(fn: SuiteLifecycleFunction) {
			if (!currentSuite) {
				throw new Error(`A suite lifecycle method must be declared within a suite`);
			}
			on(currentSuite, 'after', fn);
		},

		beforeEach(fn: SuiteLifecycleFunction) {
			if (!currentSuite) {
				throw new Error(`A suite lifecycle method must be declared within a suite`);
			}
			on(currentSuite, 'beforeEach', fn);
		},

		afterEach(fn: SuiteLifecycleFunction) {
			if (!currentSuite) {
				throw new Error(`A suite lifecycle method must be declared within a suite`);
			}
			on(currentSuite, 'afterEach', fn);
		}
	};
}
