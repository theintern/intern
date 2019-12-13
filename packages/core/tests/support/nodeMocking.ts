intern.registerPlugin('mockRequire', () => {
  function mockRequire(
    require: NodeRequire,
    mod: string,
    mocks: { [name: string]: any }
  ) {
    const registeredMocks: { id: string; original: any }[] = [];

    mod = require.resolve(mod);
    registeredMocks.push({ id: mod, original: require.cache[mod] });
    delete require.cache[mod];

    Object.keys(mocks).forEach(name => {
      const id = require.resolve(name);
      registeredMocks.push({ id, original: require.cache[id] });
      delete require.cache[id];

      // If mocks[name] is null then there's no explicit mock for the
      // module, it just needs to be reloaded to use mocks that have just
      // been defined.
      if (mocks[name] != null) {
        require.cache[id] = {
          id,
          filename: id,
          loaded: true,
          exports: mocks[name]
        } as NodeModule;
      }
    });

    return Promise.resolve({
      module: require(mod),
      remove() {
        while (registeredMocks.length > 0) {
          const { id, original } = registeredMocks.pop()!;
          delete require.cache[id];
          if (typeof original !== 'undefined') {
            require.cache[id] = original;
          }
        }
      }
    });
  }

  return <mocking.MockRequire>mockRequire;
});
