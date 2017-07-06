import { mixin } from '@dojo/core/lang';
import Environment from './Environment';
import { NormalizedEnvironment } from '@theintern/digdug/Tunnel';

/**
 * Resolves a collection of Intern test environments to a list of service environments
 *
 * @param capabilities a base set of capabilities for all environments
 * @param environments a list of user-requested enviromnents
 * @param available a list of available environments
 * @returns a list of flattened service environments
 */
export default function resolveEnvironments(capabilities: { [key: string]: any }, environments: EnvironmentOptions[], available?: NormalizedEnvironment[]) {
	// Pre-process the environments list to resolve any uses of {pwd} and do any top-level substitutions
	environments = environments.map(environment => {
		const serialized = JSON.stringify(environment);
		return JSON.parse(serialized.replace(/{pwd}/g, process.cwd()));
	});

	// flatEnviroments will have non-array versions
	const flatEnvironments = createPermutations(capabilities, environments);

	// Expand any version ranges or aliases in the environments.
	const expandedEnvironments = flatEnvironments.map(function (environment) {
		const version = resolveVersions(environment, available);
		if (version == null) {
			return environment;
		}
		return mixin({}, environment, { version });
	});

	// Perform a second round of permuting to handle any expanded version ranges
	return createPermutations({}, expandedEnvironments).map(function (environment) {
		// After permuting, environment.version will be singular again
		return new Environment(environment);
	});
}

export interface EnvironmentOptions {
	browserName: string | string[];
	version?: (string | string[] | number | number[]);
	[key: string]: any;
}

export interface FlatEnvironment {
	browserName: string;
	version?: string;
	[key: string]: any;
}

/**
 * Expands a range of versions using available environments
 */
function expandVersionRange(left: string, right: string, availableVersions: string[]) {
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
 *   - '{number}'
 *   - 'latest'
 *   - 'latest-{number}'
 */
function resolveVersionAlias(version: string, availableVersions: string[]) {
	let pieces = version.split('-');
	if (pieces.length > 2) {
		throw new Error('Invalid alias syntax "' + version + '"');
	}

	pieces = pieces.map(function (piece) {
		return piece.trim();
	});

	if (
		(pieces.length === 2 && (pieces[0] !== 'latest' || isNaN(Number(pieces[1])))) ||
		(pieces.length === 1 && isNaN(Number(pieces[0])) && pieces[0] !== 'latest')
	) {
		throw new Error('Invalid alias syntax "' + version + '"');
	}

	if (pieces[0] === 'latest') {
		// Only consider numeric versions; we don't want 'beta' or 'dev'
		const numericVersions = availableVersions.filter(version => {
			return !isNaN(parseFloat(version));
		}).sort((a, b) => {
			return parseFloat(a) - parseFloat(b);
		});

		let offset = pieces.length === 2 ? Number(pieces[1]) : 0;
		if (offset > numericVersions.length) {
			let message = 'Can\'t get ' + version + '; ' + numericVersions.length + ' version';
			message += (numericVersions.length !== 1 ? 's are' : ' is') + ' available';
			throw new Error(message);
		}

		return numericVersions[numericVersions.length - 1 - offset];
	}
	else {
		return pieces[0];
	}
}

/**
 * Splits a version into one or two version strings using the '..' delimiter
 *
 * @returns {string[]}
 */
function splitVersions(versionSpec: string) {
	const versions = versionSpec.split('..');

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
 * @param environment the environment for which versions should match
 * @param available a list of available environments
 * @returns a list of version numbers from available filtered by the current environment
 */
function getVersions(environment: EnvironmentOptions, available: NormalizedEnvironment[]): string[] {
	let versions: { [key: string]: boolean } = {};

	available.filter(function (availableEnvironment) {
		// Return true if there are no mismatching keys
		return !Object.keys(environment).filter(function (key) {
			return key !== 'version';
		}).some(function (key: keyof NormalizedEnvironment) {
			return (key in availableEnvironment) && availableEnvironment[key] !== environment[key];
		});
	}).forEach(function (availableEnvironment) {
		versions[availableEnvironment.version] = true;
	});

	return Object.keys(versions).sort((a, b) => {
		const na = Number(a);
		const nb = Number(b);
		if (!isNaN(na) && !isNaN(nb)) {
			return na - nb;
		}
		if (a < b) {
			return -1;
		}
		if (a > b) {
			return 1;
		}
		return 0;
	});
}

/**
 * Resolves version aliases (e.g. latest, latest - 1) and version ranges (e.g. 36 .. latest or latest - 3 .. latest)
 * using the environment list returned by tunnel#getEnvironments().
 *
 * @param environment an object with an optional version property
 * @param available a list of environment available on the target service
 * @returns the environment with resolved version aliases
 */
function resolveVersions(environment: FlatEnvironment, available?: NormalizedEnvironment[]): string | string[] | undefined {
	let versionSpec = environment.version;
	let versions: string[];
	available = available || [];

	if (versionSpec && isNaN(Number(versionSpec))) {
		let availableVersions = getVersions(environment, available);

		versions = splitVersions(versionSpec).map(function (version) {
			const resolved = resolveVersionAlias(version, availableVersions);
			if (resolved == null) {
				throw new Error(`Unable to resolve version "${version}" for ${environment.browserName}. Are you using the ` +
					'proper browser and platform names for the tunnel?');
			}
			return resolved;
		});

		if (versions.length === 2) {
			if (versions[0] > versions[1]) {
				throw new Error('Invalid range [' + versions + '], must be in ascending order');
			}

			versions = expandVersionRange(versions[0], versions[1], availableVersions);
		}

		return versions;
	}

	return versionSpec;
}

/**
 * Builds permutations of an object by flattening properties holding array values into a collection of objects
 * representing all combinations of objects for all arrays in the object.
 *
 * @param base a base set of properties applied to each source
 * @param sources a list of sources to flatten
 * @return a flattened collection of sources
 */
function createPermutations(base: { [key: string]: string }, sources?: EnvironmentOptions[]): FlatEnvironment[] {
	// If no expansion sources were given, the set of permutations consists of just the base
	if (!sources || sources.length === 0) {
		return [<FlatEnvironment>mixin({}, base)];
	}

	// Expand the permutation set for each source
	return sources.map(function (source) {
		return Object.keys(source).reduce((permutations: FlatEnvironment[], key: string) => {
			if (Array.isArray(source[key])) {
				// For array values, create a copy of the permutation set for each array item, then use the
				// combination of these copies as the new value of `permutations`
				permutations = source[key].map((value: any) => {
					return permutations.map(permutation => mixin({}, permutation, { [key]: value }));
				}).reduce((newPermutations: object[], keyPermutations: object[]) => {
					return newPermutations.concat(keyPermutations);
				}, []);
			}
			else {
				// For simple values, add the value to all current permutations
				permutations.forEach(permutation => {
					permutation[key] = source[key];
				});
			}
			return permutations;
		}, [<FlatEnvironment>mixin({}, base)]);
	}).reduce((newPermutations, sourcePermutations) => newPermutations.concat(sourcePermutations), []);
}
