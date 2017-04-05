import Executor from '../executors/Executor';
import { SuiteLifecycleFunction } from '../Suite';
import { TestFunction } from '../Test';
import getTddInterface from './tdd';

export interface BddInterface {
	describe(name: string, factory: SuiteLifecycleFunction): void;
	it(name: string, test: TestFunction): void;
	before(fn: SuiteLifecycleFunction): void;
	after(fn: SuiteLifecycleFunction): void;
	beforeEach(fn: SuiteLifecycleFunction): void;
	afterEach(fn: SuiteLifecycleFunction): void;
}

export default function getInterface(executor: Executor): BddInterface {
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
