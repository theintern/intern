define([ 'dojo/Deferred' ], function (Deferred) {
	/**
	 * Mock a set of dependencies for a given module
	 */
	function mock(moduleId, dependencyMap) {
		var dfd = new Deferred(),
			originalModule,
			originalDependencies = {},
			NOT_LOADED = {};

		// retrieve the original module values so they can be restored after the mocked copy has loaded
		try {
			originalModule = require(moduleId);
			require.undef(moduleId);
		}
		catch (error) {
			originalModule = NOT_LOADED;
		}

		for (var dependencyId in dependencyMap) {
			try {
				originalDependencies[dependencyId] = require(dependencyId);
				require.undef(dependencyId);
			}
			catch (error) {
				originalDependencies[dependencyId] = NOT_LOADED;
			}
		}

		// remap the module's dependencies with the provided map
		var map = {};
		map[moduleId] = dependencyMap;
		require({ map: map });

		// reload the module using the mocked dependencies
		require([moduleId], function (mockedModule) {
			// restore the original condition of the loader by replacing all the modules that were unloaded
			require.undef(moduleId);

			if (originalModule !== NOT_LOADED) {
				define(moduleId, [], function () {
					return originalModule;
				});
			}

			function loadDependency(originalDependency, dependencyId) {
				if (originalDependency !== NOT_LOADED) {
					define(dependencyId, [], function () {
						return originalDependency;
					});
				}
			}

			for (var dependencyId in dependencyMap) {
				map[moduleId][dependencyId] = dependencyId;
				require.undef(dependencyId);
				loadDependency(originalDependencies[dependencyId], dependencyId);
			}
			require({ map: map });

			// provide the mocked copy to the caller
			dfd.resolve(mockedModule);
		});

		return dfd.promise;
	}

	return { mock: mock };
});
