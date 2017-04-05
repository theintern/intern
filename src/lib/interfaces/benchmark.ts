/**
 * Interface for registering benchmark suites
 */

import Executor from '../executors/Executor';
import { isSuiteDescriptorFactory, registerSuite } from './object';
import BenchmarkTest, { BenchmarkDeferredTestFunction, BenchmarkTestFunction } from '../BenchmarkTest';
import BenchmarkSuite, { BenchmarkSuiteProperties } from '../BenchmarkSuite';

export default function getInterface(executor: Executor) {
	return {
		registerSuite(descriptor: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory) {
			// Only register benchmark suites if we're in benchmark mode
			if (!executor.config.benchmark) {
				return;
			}

			if (isSuiteDescriptorFactory<BenchmarkSuiteFactory>(descriptor)) {
				descriptor = descriptor();
			}

			registerSuite(executor, descriptor, BenchmarkSuite, BenchmarkTest);
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
