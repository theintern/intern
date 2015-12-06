import { on } from 'dojo/aspect';
import { executor } from '../../main';
import Promise = require('dojo/Promise');
import Suite from '../Suite';
import Test from '../Test';

type MaybePromise = void | Promise.Thenable<void>;

let currentSuite: Suite;
const suites: Suite[] = [];

function registerSuite(name: string, factory: () => MaybePromise) {
	const parentSuite = currentSuite;

	currentSuite = new Suite({ name: name, parent: parentSuite });
	parentSuite.tests.push(currentSuite);

	suites.push(parentSuite);
	factory.call(currentSuite);
	currentSuite = suites.pop();
}

export function suite(name: string, factory: () => void) {
	if (/* is a root suite */ !currentSuite) {
		executor.register(function (suite) {
			currentSuite = suite;
			registerSuite(name, factory);
			currentSuite = null;
		});
	}
	else {
		registerSuite(name, factory);
	}
}

export function test(name: string, test: () => MaybePromise) {
	currentSuite.tests.push(new Test({ name: name, test: test, parent: currentSuite }));
}

export function before(fn: () => MaybePromise) {
	on(currentSuite, 'setup', fn);
}

export function after(fn: () => MaybePromise) {
	on(currentSuite, 'teardown', fn);
}

export function beforeEach(fn: (test: Test) => MaybePromise) {
	on(currentSuite, 'beforeEach', fn);
}

export function afterEach(fn: (test: Test) => MaybePromise) {
	on(currentSuite, 'afterEach', fn);
}
