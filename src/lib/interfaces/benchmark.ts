import { registerSuite as objectRegisterSuite } from './object';
import { ObjectSuiteConfig } from '../../interfaces';
import { Suite } from '../Suite';
import { BenchmarkTest } from '../BenchmarkTest';
import aspect = require('dojo/aspect');

function propertyHandler(property: string, value: any, suite: Suite) {
	if (property === 'beforeEachLoop' || property === 'afterEachLoop') {
		aspect.on(suite, property, value);
		return true;
	}
}

export function registerSuite(mainDescriptor: ObjectSuiteConfig) {
	objectRegisterSuite(mainDescriptor, BenchmarkTest, propertyHandler);
};

const async = BenchmarkTest.async;
export { async as async };

const skip = BenchmarkTest.skip;
export { skip as skip };

export { BenchmarkTestFunction } from '../BenchmarkTest';
