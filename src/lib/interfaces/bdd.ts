import Executor from '../executors/Executor';
import { SuiteLifecycleFunction } from '../Suite';
import { TestFunction } from '../Test';
import { getInterface as getTddInterface, suite, test, before, after, beforeEach, afterEach } from './tdd';

export interface BddInterface {
	describe(name: string, factory: SuiteLifecycleFunction): void;
	it(name: string, test: TestFunction): void;
	before(fn: SuiteLifecycleFunction): void;
	after(fn: SuiteLifecycleFunction): void;
	beforeEach(fn: SuiteLifecycleFunction): void;
	afterEach(fn: SuiteLifecycleFunction): void;
}

export { suite as describe };
export { test as it };
export { before, after, beforeEach, afterEach };

export function getInterface(executor: Executor): BddInterface {
	const { suite, test, before, after, beforeEach, afterEach } = getTddInterface(executor);

	return {
		describe: suite,
		it: test,
		before,
		after,
		beforeEach,
		afterEach
	};
}
