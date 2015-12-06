import { on } from 'dojo/aspect';
import { executor } from '../../main';
import Promise = require('dojo/Promise');
import Suite from '../Suite';
import Test from '../Test';

type MaybePromise = void | Promise.Thenable<void>;

export interface Descriptor {
	[key: string]: any;
	name: string;
	timeout?: number;
	afterEach?: (test: Test) => MaybePromise;
	beforeEach?: (test: Test) => MaybePromise;
	setup?: () => MaybePromise;
	teardown?: () => MaybePromise;
}

function registerSuite(descriptor: Descriptor, parentSuite: Suite) {
	const suite = new Suite({ parent: parentSuite });
	const tests = suite.tests;

	parentSuite.tests.push(suite);

	for (let k in descriptor) {
		let test = descriptor[k];

		if (k === 'before') {
			k = 'setup';
		}
		if (k === 'after') {
			k = 'teardown';
		}

		switch (k) {
		case 'name':
		case 'timeout':
			(<any> suite)[k] = test;
			break;
		case 'setup':
		case 'beforeEach':
		case 'afterEach':
		case 'teardown':
			on(suite, k, test);
			break;
		default:
			if (typeof test !== 'function') {
				test.name = test.name || k;
				registerSuite(test, suite);
			}
			else {
				tests.push(new Test({ name: k, test: test, parent: suite }));
			}
		}
	}
}

export default function (mainDescriptor: Descriptor | (() => Descriptor)) {
	executor.register(function (suite: Suite) {
		let descriptor: Descriptor;

		// enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
		// without this, it becomes impossible to use the object interface for functional tests since there is no
		// other way to create a closure for each main suite
		if (typeof mainDescriptor === 'function') {
			descriptor = (<() => Descriptor> mainDescriptor)();
		}
		else {
			descriptor = <Descriptor> mainDescriptor;
		}

		registerSuite(descriptor, suite);
	});
}
