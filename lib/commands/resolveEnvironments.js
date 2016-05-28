define([
	'dojo/Promise',
	'../EnvironmentType',
	'../util'
], function (Promise, EnvironmentType, util) {
	/**
	 * Expands a range of versions using available environments
	 */
	function expandVersionRange(left, right, availableVersions) {
		left = parseInt(left, 10);
		right = parseInt(right, 10);
		return availableVersions.filter(function (version) {
			version = parseInt(version, 10);
			
			return !isNaN(version) && version >= left && version <= right;
		});
	}


	/**
	 * Resolves a version alias from a list of available versions
	 */
	function resolveVersionAlias(version, availableVersions) {
		var pieces = version.split('-').map(function (version) {
			return version.trim();
		});


		if (pieces[0] !== 'latest') {
			return version;
		}

		var offset = pieces.length === 1 ? 1 : 1 + Number(pieces[1]);
		

		if (offset > availableVersions.length) {
			throw new Error(version + ' is out of bounds. Only ' + availableVersions.length + ' available');
		}
		return availableVersions[availableVersions.length - offset];
	}

	function compareVersionStrings(a, b) {
		a = parseFloat(a.version || a);
		b = parseFloat(b.version || b);
		return a - b;
	}

	/**
	 * Splits a version into one or two version strings using the '..' delimiter
	 */
	function splitVersions(versions) {
		versions = versions.split('..').map(function (version) {
			return version.trim();
		});

		if (versions.length > 2) {
			throw new Error('Invalid version syntax');
		}

		return versions;
	}

	/**
	 * Filters out service environments that do not share the same values for shared, non-version properties
	 */
	function filterEnvironments(environment, serviceEnvironments) {
		return serviceEnvironments.filter(function (serviceEnvironment) {
			for (var property in environment) {
				var match = serviceEnvironment[property] || 
					(serviceEnvironment.descriptor && serviceEnvironment.descriptor[property]);

				if (match && property.indexOf('version') === -1 && environment[property] !== match) {
					return false;
				}
			}
			return true;
		});
	}

	/**
	 * get a list of versions from a list of available environments filtered by the current environment
	 * @param environment the environment for which versions should match
	 * @param available a list of available environments
	 * @return {Array.<number>} a list of sorted environments filtered by the current environment
	 */
	function getVersions(environment, available) {
		var versionSet = { };
		return filterEnvironments(environment, available)
			.reduce(function (versions, environment) {
				var version = environment.version;
				if (!versionSet.hasOwnProperty(version)) {
					versionSet[version] = environment;
					versions.push(version);
				}
				return versions;
			}, [])
			.sort(compareVersionStrings);
	}

	/**
	 * Resolves version aliases (e.g. latest, latest - 1) and version ranges (e.g. 36 .. latest or
	 * latest - 3 .. latest) using the environment list returned by tunnel#getEnvironments().
	 *
	 * @param environment an object with an optional version property
	 * @param available {Promise} a list of enviornment available on the target service
	 * @return {Object} the environment with resolved version aliases
	 */
	function resolveVersions(environment, available) {
		var versions = environment.version;
		
		if (!versions || !isNaN(Number(versions))) {
			// No version or version is a number. No resolution needed.
			return environment;
		}

		return available.then(function (available) {
			var availableVersions = getVersions(environment, available);
			
			versions = splitVersions(versions) // split version ranges
				.map(function (version) {
					// resolve version aliases
					return resolveVersionAlias(version, availableVersions);
				})
				.sort(compareVersionStrings); // sort in case version range is backwards (because we're nice)
			
			if (versions.length === 2) {
				versions = expandVersionRange(versions[0], versions[1], availableVersions);
			}
			environment.version = versions;
			return environment;
		});
	}

	/**
	 * Resolve a collection of Intern test environments to a list of service environments
	 * @param capabilities a base set of capabilities for all environments
	 * @param environments a list of Intern described enviromnents
	 * @param available {Promise} a list of available environments as provided by the service
	 * @return {Promise<EnvironmentType>} a list of flattened service environments
	 */
	function resolveEnvironments(capabilities, environments, available) {
		return Promise.all(
			util.createPermutations(capabilities, environments)
				.map(function (environment) {
					return resolveVersions(environment, available);
				})
		).then(function (environments) {
			// Ensure version vectors created from version ranges are flattened
			return util.createPermutations({}, environments)
				.map(function (environment) {
					return new EnvironmentType(environment);
				});
		});
	}
	
	return resolveEnvironments;
});
