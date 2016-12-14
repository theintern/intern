import Suite from './Suite';

export interface RootSuite {

}

export interface SuiteFactory {
	(suite: RootSuite): void;
}

export class SuiteManager {
	// TODO replace w/ a set to avoid duplicates?
	factories: SuiteFactory[] = [];

	/**
	 * Register a factory used to create tests and suites
	 */
	register(factory: SuiteFactory): void {
		this.factories.push(factory);
	}

	/**
	 * Attach tests to the provided parent Suite
	 */
	attach(parent: RootSuite): void {
		for (let factory of this.factories) {
			factory(parent);
		}
	}
}

export let manager = new SuiteManager();

export function setManager(newManager: SuiteManager) {
	manager = newManager;
}

export function register(factory: SuiteFactory) {
	manager.register(factory);
}

export function attach(parent: Suite) {
	manager.attach(parent);
}
