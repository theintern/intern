/**
 * Object interface for registering suites
 */

import Suite, { SuiteOptions, SuiteProperties } from '../Suite';
import Test, { TestFunction } from '../Test';
import Executor from '../executors/Executor';

export default function getInterface(executor: Executor) {
	return {
		registerSuite(descriptor: ObjectSuiteDescriptor | ObjectSuiteFactory) {
			executor.addSuite(parent => {
				// Enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
				// without this, it becomes impossible to use the object interface for functional tests since there is no
				// other way to create a closure for each main suite
				if (isSuiteDescriptorFactory<ObjectSuiteFactory>(descriptor)) {
					descriptor = descriptor();
				}

				parent.add(createSuite(executor, descriptor, Suite, Test));
			});
		}
	};
}

export interface ObjectInterface {
	registerSuite(mainDescriptor: ObjectSuiteDescriptor | ObjectSuiteFactory): void;
}

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

export function createSuite<S extends typeof Suite, T extends typeof Test>(executor: Executor, descriptor: NestedSuiteDescriptor, SuiteClass: S, TestClass: T) {
	let options: SuiteOptions = { name: null, tests: [] };

	// Initialize a new SuiteOptions object from the provided ObjectSuiteDescriptor
	Object.keys(descriptor).filter(key => {
		return key !== 'tests';
	}).forEach((key: keyof NestedSuiteDescriptor) => {
		let optionsKey: keyof SuiteOptions = <any>key;

		// Convert 'setup' and 'teardown' to 'before' and 'after'
		if (<string>key === 'setup') {
			executor.emit('deprecated', {
				original: 'Suite#setup',
				replacement: 'Suite#before'
			});
			optionsKey = <keyof SuiteOptions>'before';
		}
		else if (<string>key === 'teardown') {
			executor.emit('deprecated', {
				original: 'Suite#teardown',
				replacement: 'Suite#after'
			});
			optionsKey = <keyof SuiteOptions>'after';
		}

		options[optionsKey] = <any>descriptor[key];
	});

	const suite = new SuiteClass(options);
	const tests = descriptor.tests;

	Object.keys(tests).map(name => {
		const thing = tests[name];

		if (isNestedSuiteDescriptor(thing)) {
			return createSuite(executor, {
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

function isNestedSuiteDescriptor(value: any): value is NestedSuiteDescriptor {
	return value && typeof value.tests === 'object';
}
