import * as aspect from 'dojo/aspect';
import * as main from '../../main';
import { Suite } from '../Suite';
import { Test } from '../Test';
import { ObjectSuiteConfig } from '../../interfaces';

function _registerSuite(descriptor: ObjectSuiteConfig, parentSuite: Suite): void {
	/* jshint maxcomplexity: 13 */
	let suite = new Suite({ parent: parentSuite });
	let tests = suite.tests;
	let test: any;

	parentSuite.tests.push(suite);

	for (let k in descriptor) {
		test = descriptor[k];

		if (k === 'before') {
			k = 'setup';
		}
		if (k === 'after') {
			k = 'teardown';
		}

		switch (k) {
		case 'name':
		case 'timeout':
			(<{ [key: string]: any }> suite)[k] = test;
			break;
		case 'setup':
		case 'beforeEach':
		case 'afterEach':
		case 'teardown':
			aspect.on(suite, k, test);
			break;
		default:
			if (typeof test !== 'function') {
				test.name = test.name || k;
				_registerSuite(test, suite);
			}
			else {
				tests.push(new Test({ name: k, test: test, parent: suite }));
			}
		}
	}
}

function registerSuite(mainDescriptor: ObjectSuiteConfig): void {
	main.executor.register(function (suite: Suite) {
		let descriptor = mainDescriptor;

		// enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
		// without this, it becomes impossible to use the object interface for functional tests since there is no
		// other way to create a closure for each main suite
		if (typeof descriptor === 'function') {
			descriptor = descriptor();
		}

		_registerSuite(descriptor, suite);
	});
}

export = registerSuite;
