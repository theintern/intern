/**
 * Object interface for registering suites
 */

import Suite, { SuiteOptions, SuiteProperties } from '../Suite';
import Test, { TestFunction } from '../Test';
import Executor from '../executors/Executor';

export default function getInterface(executor: Executor) {
	return {
		registerSuite(descriptor: ObjectSuiteDescriptor | ObjectSuiteFactory) {
			// Enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
			// without this, it becomes impossible to use the object interface for functional tests since there is no
			// other way to create a closure for each main suite
			if (isSuiteDescriptorFactory<ObjectSuiteFactory>(descriptor)) {
				descriptor = descriptor();
			}

			registerSuite(executor, descriptor, Suite, Test);
		}
	};
}

export interface ObjectInterface {
	registerSuite(mainDescriptor: ObjectSuiteDescriptor | ObjectSuiteFactory): void;
}

export type SuiteDescriptor = {
	tests: { [name: string]: SuiteDescriptor | TestFunction };
};

export type NestedSuiteDescriptor = Partial<SuiteProperties> & {
	tests: { [name: string]: NestedSuiteDescriptor | TestFunction };
};

export type ObjectSuiteDescriptor = NestedSuiteDescriptor & {
	name: string;
};

export interface ObjectSuiteFactory {
	(): ObjectSuiteDescriptor;
}

export function isSuiteDescriptorFactory<T>(value: any): value is T {
	return typeof value === 'function';
}

export function registerSuite<P extends SuiteDescriptor, S extends typeof Suite, T extends typeof Test>(executor: Executor, descriptor: P, SuiteClass: S, TestClass: T) {
	executor.addTest(createSuite(descriptor, SuiteClass, TestClass));
}

function isNestedSuiteDescriptor(value: any): value is SuiteDescriptor {
	return value && typeof value.tests === 'object';
}

function createSuite<P extends SuiteDescriptor, S extends typeof Suite, T extends typeof Test>(descriptor: P, SuiteClass: S, TestClass: T) {
	let options: SuiteOptions = { name: null, tests: [] };

	// Initialize a new SuiteOptions object from the provided ObjectSuiteDescriptor
	Object.keys(descriptor).filter(key => {
		return key !== 'tests';
	}).forEach((key: keyof typeof descriptor) => {
		(<any>options)[key] = descriptor[key];
	});

	const suite = new SuiteClass(options);
	const tests = descriptor.tests;

	Object.keys(tests).map(name => {
		const thing = tests[name];

		if (isNestedSuiteDescriptor(thing)) {
			return createSuite({
				name,
				...thing
			}, SuiteClass, TestClass);
		}

		return new TestClass({ name, test: thing });
	}).forEach(suiteOrTest => {
		suite.add(suiteOrTest);
	});

	return suite;
}

export interface PropertyHandler {
	(key: string, value: any, suite: Suite): boolean;
}
