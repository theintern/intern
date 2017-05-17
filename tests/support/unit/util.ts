import Executor from 'src/lib/executors/Executor';
import Test, { TestProperties, TestOptions } from 'src/lib/Test';
import Suite, { SuiteProperties, SuiteOptions } from 'src/lib/Suite';
import { Remote } from 'src/lib/executors/Node';

import { mixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';

export function createExecutor(properties?: any) {
	const executor: Executor = <any>{
		emit() {
			return Task.resolve();
		},
		log() {
			return Task.resolve();
		}
	};
	return mixin(executor, properties);
}

export function createRemote(options?: any) {
	return <Remote>options;
}

export function createSuite(name?: string, options: Partial<SuiteProperties> & { tests?: (Suite | Test)[] } = <any>{}) {
	if (!options.executor && !(options.parent && options.parent.executor)) {
		options.executor = createExecutor(options.executor);
	}
	options.name = options.name || name;
	return new Suite(<SuiteOptions>options);
}

export function createTest(name: string, options: Partial<TestProperties> & { executor?: Executor } = {}): Test {
	if (!options.test) {
		options.test = () => {};
	}
	options.name = name;
	return new Test(<TestOptions>options);
}
