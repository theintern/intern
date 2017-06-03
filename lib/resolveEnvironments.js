define([
	'dojo/lang',
	'./EnvironmentType'
], function (lang, EnvironmentType) {
	/**
	 * Expands a range of versions using available environments
	 */
	function expandVersionRange(left, right, availableVersions) {
		left = Number(left);
		right = Number(right);
		if (availableVersions.indexOf(left) === -1 || availableVersions.indexOf(right) === -1) {
			throw new Error('The version range ' + left + '..' + right + ' is unavailable');
		}
		return availableVersions.filter(function (version) {
			return version >= left && version <= right;
		});
	}

	/**
	 * Resolves a version alias from a list of available versions.
	 *
	 * Assumes availableVersions is sorted in ascending order. Acceptable versions are:
	 *
	 *   - {number}
	 *   - '{number}'
	 *   - 'latest'
	 *   - 'latest-{number}'
	 *
	 * @returns {number}
	 */
	function resolveVersionAlias(version, availableVersions) {
		var pieces = version.split('-');
		if (pieces.length > 2) {
			throw new Error('Invalid alias syntax "' + version + '"');
		}
			
		pieces = pieces.map(function (piece) {
			return piece.trim();
		});

		if (
			(pieces.length === 2 && (pieces[0] !== 'latest' || isNaN(pieces[1]))) ||
			(pieces.length === 1 && isNaN(pieces[0] && pieces[0] !== 'latest'))
		) {
			throw new Error('invalid alias syntax "' + version + '"');
		}

		if (pieces[0] === 'latest') {
			var offset = pieces.length === 2 ? Number(pieces[1]) : 0;
			if (offset > availableVersions.length) {
				var message = 'Can\'t get ' + version + '; ' + availableVersions.length + ' version';
				message += (availableVersions.length !== 1 ? 's are' : ' is') + ' available';
				throw new Error(message);
			}

			return availableVersions[availableVersions.length - 1 - offset];
		}
		else {
			return Number(pieces[0]);
		}
	}

	/**
	 * Splits a version into one or two version strings using the '..' delimiter
	 *
	 * @returns {string[]}
	 */
	function splitVersions(versions) {
		versions = versions.split('..');
		if (versions.length > 2) {
			throw new Error('Invalid version syntax');
		}
			
		return versions.map(function (version) {
			return version.trim();
		});
	}

	/**
	 * Get a list of versions from a list of available environments filtered by the current environment.
	 *
	 * @param {Object} environment the environment for which versions should match
	 * @param {Object[]} available a list of available environments
	 * @returns {number[]} a list of version numbers from available filtered by the current environment
	 */
	function getVersions(environment, available) {
		var versions = {};

		available.filter(function (availableEnvironment) {
			// Return true if there are no mismatching keys
			return !Object.keys(environment).filter(function (key) {
				return key !== 'version';
			}).some(function (key) {
				return (key in availableEnvironment) && availableEnvironment[key] !== environment[key];
			});
		}).forEach(function (environment) {
			versions[environment.version] = true;
		});
			
		return Object.keys(versions).map(function (version) {
			return Number(version);
		}).filter(function (version) {
			// We're only concerned with numeric versions
			return !isNaN(version);
		}).sort(function (a, b) {
			// Sort in ascending order
			return a - b;
		});
	}

	/**
	 * Resolves version aliases (e.g. latest, latest - 1) and version ranges (e.g. 36 .. latest or latest - 3 .. latest)
	 * using the environment list returned by tunnel#getEnvironments().
	 *
	 * @param {Object} environment an object with an optional version property
	 * @param {Object[]} available a list of enviornment available on the target service
	 * @returns {Object} the environment with resolved version aliases
	 */
	function resolveVersions(environment, available) {
		var versions = environment.version;
		available = available || [];
		
		if (versions && isNaN(versions)) {
			var availableVersions = getVersions(environment, available);
			
			versions = splitVersions(versions).map(function (version) {
				return resolveVersionAlias(version, availableVersions);
			});

			if (versions.length === 2) {
				if (versions[0] > versions[1]) {
					throw new Error('Invalid range [' + versions + '], must be in ascending order');
				}
			
				versions = expandVersionRange(versions[0], versions[1], availableVersions);
			}
		}

		return versions;
	}

	/**
	 * Builds permutations of an object by flattening properties holding array values into a collection of objects
	 * representing all combinations of objects for all arrays in the object.
	 *
	 * @param base {Object} a base set of properties applied to each source
	 * @param sources {Array.<Object>} a list of sources to flatten
	 * @return {Object[]} a flattened collection of sources
	 */
	function createPermutations(base, sources) {
		// If no expansion sources were given, the set of permutations consists of just the base
		if (!sources || sources.length === 0) {
			return [ lang.mixin({}, base) ];
		}

		// Expand the permutation set for each source
		return sources.map(function (source) {
			return Object.keys(source).reduce(function (permutations, key) {
				if (Array.isArray(source[key])) {
					// For array values, create a copy of the permutation set for each array item, then use the
					// combination of these copies as the new value of `permutations`
					permutations = source[key].map(function (value) {
						return permutations.map(function (permutation) {
							var clone = lang.mixin({}, permutation);
							clone[key] = value;
							return clone;
						});
					}).reduce(function (newPermutations, keyPermutations) {
						return newPermutations.concat(keyPermutations);
					}, []);
				}
				else {
					// For simple values, add the value to all current permutations
					permutations.forEach(function (permutation) {
						permutation[key] = source[key];
					});
				}
				return permutations;
			}, [ lang.mixin({}, base) ]);
		}).reduce(function (newPermutations, sourcePermutations) {
			return newPermutations.concat(sourcePermutations);
		}, []);
	}

	/**
	 * Resolves a collection of Intern test environments to a list of service environments
	 *
	 * @param {Object} capabilities a base set of capabilities for all environments
	 * @param {Object[]} environments a list of user-requested enviromnents
	 * @param {Object[]?} available a list of available environments
	 * @returns {EnvironmentType} a list of flattened service environments
	 */
	function resolveEnvironments(capabilities, environments, available) {
		environments = createPermutations(capabilities, environments);

		// Expand any version ranges or aliases in the environments.
		environments.forEach(function (environment) {
			environment.version = resolveVersions(environment, available);
		});

		// Perform a second round of permuting to handle any expanded version ranges
		return createPermutations({}, environments).map(function (environment) {
			return new EnvironmentType(environment);
		});
	}
	
	return resolveEnvironments;
});
