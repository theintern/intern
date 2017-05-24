intern.registerPlugin('mocking', () => {
	const registeredMocks: { id: string, original: any }[] = [];

	function removeMocks() {
		while (registeredMocks.length > 0) {
			const { id, original } = registeredMocks.pop()!;
			require.cache[id] = original;
		}
	}

	function requireWithMocks(contextRequire: NodeRequire, mod: string, mocks: { [name: string]: any }) {
		registeredMocks.push({ id: contextRequire.resolve(mod), original: undefined });
		Object.keys(mocks).forEach(name => {
			const id = contextRequire.resolve(name);
			registeredMocks.push({ id, original: require.cache[id] });
			require.cache[id] = {
				id,
				filename: id,
				loaded: true,
				exports: mocks[name]
			};
		});
		delete require.cache[mod];
		return Promise.resolve(contextRequire(mod));
	}

	return { requireWithMocks, removeMocks };
});
