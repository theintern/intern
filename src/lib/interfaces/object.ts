/**
 * Object interface for registering suites
 *
 * Suites are described using objects. The object structure is a subset of suite properties, specifically name, the
 * lifecycle methods, and tests.
 *
 *     registerSuite('foo', {
 *         before() {},
 *         afterEach() {},
 *         tests: {
 *             bar() {},
 *             baz() {}
 *         }
 *     });
 *
 * Tests may also describe sub-suites:
 *
 *     registerSuite('foo', {
 *         tests: {
 *             fooStuff {
 *                 tests: {
 *                     bar() {},
 *                     baz() {}
 *                 }
 *             }
 *         }
 *     });
 *
 * Sub-suites don't need name properties, and may also omit the 'tests' nesting if no lifecycle functions are in use.
 * The rule is that if a 'tests' property isn't in the sub-suite object, then every property is assumed to refer to a
 * test.
 *
 *     registerSuite('foo', {
 *         fooStuff {
 *             bar() {},
 *             baz() {}
 *         }
 *     });
 */

import Suite, { SuiteOptions, SuiteProperties } from '../Suite';
import Test, { TestFunction, isTestFunction } from '../Test';
import Executor from '../executors/Executor';
import intern from '../../intern';

/**
 * Importable interface that uses the currently installed global executor
 */
export default function registerSuite(name: string, descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests) {
	return _registerSuite(intern(), name, descriptorOrFactory);
}

/**
 * Interface factory used by Executor
 */
export function getInterface(executor: Executor) {
	return {
		registerSuite(name: string, descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests) {
			return _registerSuite(executor, name, descriptorOrFactory);
		}
	};
}

export interface ObjectInterface {
	registerSuite(name: string, mainDescriptor: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests): void;
}

export interface Tests {
	[name: string]: ObjectSuiteDescriptor | TestFunction | Tests;
}

export type ObjectSuiteDescriptor = Partial<SuiteProperties> & { tests: Tests; };

export interface ObjectSuiteFactory {
	(): ObjectSuiteDescriptor | Tests;
}

export function isSuiteDescriptorFactory<T>(value: any): value is T {
	return typeof value === 'function';
}

export function createSuite<S extends typeof Suite, T extends typeof Test>(name: string, parent: Suite, descriptor: ObjectSuiteDescriptor | Tests, SuiteClass: S, TestClass: T) {
	let options: SuiteOptions = { name: name, parent };
	let tests: Tests;

	// Initialize a new SuiteOptions object from the provided ObjectSuiteDescriptor
	if (isObjectSuiteDescriptor(descriptor)) {
		Object.keys(descriptor).filter(key => {
			return key !== 'tests';
		}).forEach((key: keyof ObjectSuiteDescriptor) => {
			let optionsKey: keyof SuiteOptions = <any>key;

			// Convert 'setup' and 'teardown' to 'before' and 'after'
			if (<string>key === 'setup') {
				parent.executor.emit('deprecated', {
					original: 'Suite#setup',
					replacement: 'Suite#before'
				});
				optionsKey = <keyof SuiteOptions>'before';
			}
			else if (<string>key === 'teardown') {
				parent.executor.emit('deprecated', {
					original: 'Suite#teardown',
					replacement: 'Suite#after'
				});
				optionsKey = <keyof SuiteOptions>'after';
			}

			options[optionsKey] = <any>descriptor[key];
		});

		tests = descriptor.tests;
	}
	else {
		tests = descriptor;
	}

	const suite = new SuiteClass(options);

	Object.keys(tests).map(name => {
		const thing = tests[name];
		if (isTestFunction(thing)) {
			return new TestClass({ name, test: thing, parent: suite });
		}
		return createSuite(name, suite, { ...thing }, SuiteClass, TestClass);
	}).forEach(suiteOrTest => {
		suite.add(suiteOrTest);
	});

	return suite;
}

function isObjectSuiteDescriptor(value: any): value is ObjectSuiteDescriptor {
	return typeof value === 'object' && typeof value.tests === 'object';
}

function _registerSuite(executor: Executor, name: string, descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests) {
	executor.addSuite(parent => {
		// Enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
		// without this, it becomes impossible to use the object interface for functional tests since there is no
		// other way to create a closure for each main suite
		let descriptor: ObjectSuiteDescriptor | Tests;

		if (isSuiteDescriptorFactory<ObjectSuiteFactory>(descriptorOrFactory)) {
			descriptor = descriptorOrFactory();
		}
		else {
			descriptor = descriptorOrFactory;
		}

		parent.add(createSuite(name, parent, descriptor, Suite, Test));
	});
}
