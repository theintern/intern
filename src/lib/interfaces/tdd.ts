import { on } from '@dojo/core/aspect';
import Suite, { SuiteProperties } from '../Suite';
import Test, { TestProperties } from '../Test';
import Executor from '../executors/Executor';
import intern from '../../intern';

export interface TddInterface extends TddLifecycleInterface {
	suite(name: string, factory: TddSuiteFactory): void;
	test(name: string, test: TestProperties['test']): void;
}

export interface TddLifecycleInterface {
	before(fn: SuiteProperties['before']): void;
	after(fn: SuiteProperties['after']): void;
	beforeEach(fn: SuiteProperties['beforeEach']): void;
	afterEach(fn: SuiteProperties['afterEach']): void;
}

export type TddSuiteFactory = (suite: Suite) => void;

export function suite(name: string, factory: TddSuiteFactory) {
	return _suite(intern(), name, factory);
}

export function test(name: string, test: TestProperties['test']) {
	if (!currentSuite) {
		throw new Error('A test must be declared within a suite');
	}
	currentSuite.add(new Test({ name, test }));
}

export function before(fn: SuiteProperties['before']) {
	if (!currentSuite) {
		throw new Error(`A suite lifecycle method must be declared within a suite`);
	}
	on(currentSuite, 'before', fn);
}

export function after(fn: SuiteProperties['after']) {
	if (!currentSuite) {
		throw new Error(`A suite lifecycle method must be declared within a suite`);
	}
	on(currentSuite, 'after', fn);
}

export function beforeEach(fn: SuiteProperties['beforeEach']) {
	if (!currentSuite) {
		throw new Error(`A suite lifecycle method must be declared within a suite`);
	}
	on(currentSuite, 'beforeEach', fn);
}

export function afterEach(fn: SuiteProperties['afterEach']) {
	if (!currentSuite) {
		throw new Error(`A suite lifecycle method must be declared within a suite`);
	}
	on(currentSuite, 'afterEach', fn);
}

export function getInterface(executor: Executor): TddInterface {
	return {
		suite(name: string, factory: TddSuiteFactory) {
			return _suite(executor, name, factory);
		},

		test,
		before,
		after,
		beforeEach,
		afterEach
	};
}

let currentSuite: Suite | null;

function registerSuite(name: string, factory: TddSuiteFactory) {
	const parent = currentSuite!;

	currentSuite = new Suite({ name, parent });
	parent.add(currentSuite);

	factory(currentSuite);

	currentSuite = parent;
}

function _suite(executor: Executor, name: string, factory: TddSuiteFactory) {
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
}
