/// <reference types="@dojo/loader"/>

intern.registerPlugin('mocking', () => {
	const registeredMocks: { id: string, original: any }[] = [];

	function removeMocks() {
		while (registeredMocks.length > 0) {
			const { id, original } = registeredMocks.pop()!;
			define(id, [], () => original);
			require.undef(id);
		}
	}

	function requireWithMocks(_require: (id: string) => any, mod: string, mocks: { [key: string]: any }) {
		registeredMocks.push({ id: mod, original: undefined });
		Object.keys(mocks).forEach(id => {
			const mock = mocks[id];
			const original = require(id);
			intern.log('mocked', id);
			registeredMocks.push({ id, original });
			require.undef(id);
			define(id, [], () => mock);
		});

		// return System.import(mod);
		return new Promise(resolve => {
			require([ mod ], resolve);
		});
	}

	return { requireWithMocks, removeMocks };
});
