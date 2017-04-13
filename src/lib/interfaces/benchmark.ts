/**
 * Interface for registering benchmark suites
 */

import Executor from '../executors/Executor';
import { createSuite, isSuiteDescriptorFactory } from './object';
import BenchmarkTest, { BenchmarkDeferredTestFunction, BenchmarkTestFunction } from '../BenchmarkTest';
import BenchmarkSuite, { BenchmarkSuiteProperties } from '../BenchmarkSuite';

export default function getInterface(executor: Executor) {
	return {
		registerSuite(descriptor: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory) {
			// Only register benchmark suites if we're in benchmark mode
			if (!executor.config.benchmark) {
				return;
			}

			executor.addSuite(parent => {
				// Enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
				// without this, it becomes impossible to use the object interface for functional tests since there is no
				// other way to create a closure for each main suite
				if (isSuiteDescriptorFactory<BenchmarkSuiteFactory>(descriptor)) {
					descriptor = descriptor();
				}

				parent.add(createSuite(executor, descriptor, BenchmarkSuite, BenchmarkTest));
			});
		},

		async: BenchmarkTest.async
	};
}

export interface BenchmarkInterface {
	registerSuite(descriptor: BenchmarkSuiteDescriptor): void;
	async: (testFunction: BenchmarkDeferredTestFunction, numCallsUntilResolution?: number) => BenchmarkTestFunction;
}

export type NestedBenchmarkSuiteDescriptor = Partial<BenchmarkSuiteProperties> & {
	tests: { [name: string]: NestedBenchmarkSuiteDescriptor | BenchmarkTestFunction };
};

export type BenchmarkSuiteDescriptor = NestedBenchmarkSuiteDescriptor & {
	name: string;
};

export interface BenchmarkSuiteFactory {
	(): BenchmarkSuiteDescriptor;
}
