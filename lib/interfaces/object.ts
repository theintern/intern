import { on } from 'dojo/aspect';
import { executor } from '../../main';
import Promise = require('dojo/Promise');
import Suite from '../Suite';
import Test from '../Test';

type MaybePromise = void | Promise.Thenable<void>;

export interface StaticKeys {
	name: string;
	timeout?: number;
	after?: () => MaybePromise;
	afterEach?: (test: Test) => MaybePromise;
	before?: () => MaybePromise;
	beforeEach?: (test: Test) => MaybePromise;
	setup?: () => MaybePromise;
	teardown?: () => MaybePromise;
}

type Descriptor = { [key: string]: Descriptor | (() => MaybePromise); } & StaticKeys;

function registerSuite(descriptor: Descriptor, parentSuite: Suite) {
	const suite = new Suite({ parent: parentSuite });
	const tests = suite.tests;

	parentSuite.tests.push(suite);

	if ('name' in descriptor) {
		suite.name = descriptor.name;
	}
	if ('timeout' in descriptor) {
		suite.timeout = descriptor.timeout;
	}
	if ('after' in descriptor) {
		on(suite, 'teardown', descriptor.after);
	}
	if ('afterEach' in descriptor) {
		on(suite, 'afterEach', descriptor.afterEach);
	}
	if ('before' in descriptor) {
		on(suite, 'setup', descriptor.before);
	}
	if ('beforeEach' in descriptor) {
		on(suite, 'beforeEach', descriptor.beforeEach);
	}
	if ('setup' in descriptor) {
		on(suite, 'setup', descriptor.setup);
	}
	if ('teardown' in descriptor) {
		on(suite, 'teardown', descriptor.teardown);
	}

	for (let k in descriptor) {
		let test = descriptor[k];
		switch (k) {
		case 'name':
		case 'timeout':
		case 'after':
		case 'before':
		case 'setup':
		case 'beforeEach':
		case 'afterEach':
		case 'teardown':
			break;
		default:
			if (typeof test !== 'function') {
				(<Descriptor> test).name = (<Descriptor> test).name || k;
				registerSuite(<Descriptor> test, suite);
			}
			else {
				tests.push(new Test({ name: k, test: <() => MaybePromise> test, parent: suite }));
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
