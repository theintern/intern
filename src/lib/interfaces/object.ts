import * as aspect from 'dojo/aspect';
import * as main from '../../main';
import Suite, { SuiteConfig, SuiteLifecycleFunction } from '../Suite';
import Test from '../Test';

export interface ObjectSuiteConfig extends SuiteConfig {
	after?: SuiteLifecycleFunction;
	before?: SuiteLifecycleFunction;
}

export interface PropertyHandler {
	(property: string, value: any, suite: Suite): boolean;
}

function createSuite(descriptor: ObjectSuiteConfig, parentSuite: Suite, TestClass?: typeof Test, propertyHandler?: PropertyHandler): void {
	/* jshint maxcomplexity: 13 */
	let suite = new Suite({ parent: parentSuite });
	let tests = suite.tests;
	let test: any;
	let handled: boolean;

	parentSuite.tests.push(suite);

	for (let k in descriptor) {
		test = descriptor[k];
		handled = propertyHandler && propertyHandler(k, test, suite);

		if (!handled) {
			handled = defaultPropertyHandler(k, test, suite);
		}

		if (!handled) {
			// Test isn't a function; assume it's a nested suite
			if (typeof test !== 'function') {
				test.name = test.name || k;
				createSuite(test, suite, TestClass, propertyHandler);
			}
			// Test is a function; create a Test instance for it
			else {
				tests.push(new TestClass({ name: k, test: test, parent: suite }));
			}
		}
	}
}

function defaultPropertyHandler(property: string, value: any, suite: Suite) {
	if (property === 'before') {
		property = 'setup';
	}
	if (property === 'after') {
		property = 'teardown';
	}

	switch (property) {
		case 'name':
		case 'timeout':
			(<{ [key: string]: any }> suite)[property] = value;
			return true;

		case 'setup':
		case 'beforeEach':
		case 'afterEach':
		case 'teardown':
			aspect.on(suite, property, value);
			return true;
	}

	return false;
}

/**
 * Register a new test suite. If provided, tests will be constructed using TestClass.
 *
 * @param mainDescriptor Object or IIFE describing the suite
 * @param TestClass Class to use to construct individual tests
 * @param propertyHandler Function to handle any properties that shouldn't be used as tests
 */
export default function registerSuite(mainDescriptor: ObjectSuiteConfig, TestClass?: typeof Test, propertyHandler?: PropertyHandler): void {
	TestClass = TestClass || Test;

	main.executor.register(function (suite: Suite) {
		let descriptor = mainDescriptor;

		// enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
		// without this, it becomes impossible to use the object interface for functional tests since there is no
		// other way to create a closure for each main suite
		if (typeof descriptor === 'function') {
			descriptor = descriptor();
		}

		createSuite(descriptor, suite, TestClass, propertyHandler);
	});
}
