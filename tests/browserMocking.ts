intern.registerPlugin('mocking', () => {
	const registeredMocks: { name: string, original: any }[] = [];

	function removeMocks() {
		while (registeredMocks.length > 0) {
			const { name, original } = registeredMocks.pop()!;
			if (original) {
				System.registry.set(System.normalizeSync(name), original);
			}
			else {
				System.registry.delete(System.normalizeSync(name));
			}
		}
	}

	function requireWithMocks(_require: (id: string) => any, mod: string, mocks: { [key: string]: any }) {
		registeredMocks.push({ name: mod, original: undefined });
		Object.keys(mocks).forEach(name => {
			const mock = mocks[name];
			const original = System.registry.get(System.normalizeSync(name));
			System.registry.delete(System.normalizeSync(name));
			System.registry.set(System.normalizeSync(name), System.newModule(mock));
			intern.log('mocked', System.normalizeSync(name));
			registeredMocks.push({ name, original });
		});
		return System.import(mod);
	}

	return { requireWithMocks, removeMocks };
});
