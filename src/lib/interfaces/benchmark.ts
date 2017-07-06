/**
 * Interface for registering benchmark suites
 */

import Executor from '../executors/Executor';
import { createSuite, isSuiteDescriptorFactory } from './object';
import BenchmarkTest, { BenchmarkDeferredTestFunction, BenchmarkTestFunction } from '../BenchmarkTest';
import BenchmarkSuite, { BenchmarkSuiteProperties } from '../BenchmarkSuite';
import intern from '../../intern';

/**
 * Importable interface that uses the currently installed global executor
 */
export default function registerSuite(name: string, descriptorOrFactory: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory | Tests) {
	return _registerSuite(intern(), name, descriptorOrFactory);
}

/**
 * Interface factory used by Executor
 */
export function getInterface(executor: Executor) {
	return {
		registerSuite(name: string, descriptorOrFactory: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory | Tests) {
			return _registerSuite(executor, name, descriptorOrFactory);
		},

		async: BenchmarkTest.async
	};
}

export interface BenchmarkInterface {
	registerSuite(name: string, descriptor: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory | Tests): void;
	async: (testFunction: BenchmarkDeferredTestFunction, numCallsUntilResolution?: number) => BenchmarkTestFunction;
}

export interface Tests {
	[name: string]: BenchmarkSuiteDescriptor | BenchmarkTestFunction;
}

export type BenchmarkSuiteDescriptor = Partial<BenchmarkSuiteProperties> & {
	tests: Tests
};

export interface BenchmarkSuiteFactory {
	(): BenchmarkSuiteDescriptor | Tests;
}

function _registerSuite(executor: Executor, name: string, descriptorOrFactory: BenchmarkSuiteDescriptor | BenchmarkSuiteFactory | Tests) {
	// Only register benchmark suites if we're in benchmark mode
	if (!executor.config.benchmark) {
		executor.log('Not registering benchmark suite ' + name + ' because benchmarking is disabled');
		return;
	}

	executor.addSuite(parent => {
		// Enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
		// without this, it becomes impossible to use the object interface for functional tests since there is no
		// other way to create a closure for each main suite
		let descriptor: BenchmarkSuiteDescriptor | Tests;

		if (isSuiteDescriptorFactory<BenchmarkSuiteFactory>(descriptorOrFactory)) {
			descriptor = descriptorOrFactory();
		}
		else {
			descriptor = descriptorOrFactory;
		}

		parent.add(createSuite(name, parent, descriptor, BenchmarkSuite, BenchmarkTest));
	});
}
