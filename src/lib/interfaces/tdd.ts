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
	return {
		suite(name: string, factory: (suite: Suite) => void) {
			if (!currentSuite) {
				executor.addSuite(parent => {
					currentSuite = parent;
					registerSuite(name, factory);
					currentSuite = null;
				});
			}
			else {
				registerSuite(name, factory);
			}
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

let currentSuite: Suite;

function registerSuite(name: string, factory: (suite: Suite) => void) {
	const parent = currentSuite;

	currentSuite = new Suite({ name });
	parent.add(currentSuite);

	factory(currentSuite);

	currentSuite = parent;
}
