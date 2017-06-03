intern.registerPlugin('mockRequire', () => {
	function mockRequire(require: NodeRequire, mod: string, mocks: { [name: string]: any }) {
		const registeredMocks: { id: string, original: any, require: NodeRequire }[] = [];

		mod = require.resolve(mod);
		registeredMocks.push({ id: mod, original: undefined, require });
		Object.keys(mocks).forEach(name => {
			const id = require.resolve(name);
			registeredMocks.push({ id, original: require.cache[id], require });
			require.cache[id] = {
				id,
				filename: id,
				loaded: true,
				exports: mocks[name]
			};
		});
		delete require.cache[mod];

		return Promise.resolve({
			module: require(mod),
			remove() {
				while (registeredMocks.length > 0) {
					const { id, original, require } = registeredMocks.pop()!;
					require.cache[id] = original;
				}
			}
		});
	}

	return <mocking.MockRequire>mockRequire;
});
