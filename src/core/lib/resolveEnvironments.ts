import { NormalizedEnvironment } from '../../tunnels/Tunnel';
import { normalize } from 'path';

import process from './node/process';
import Environment from './Environment';

/**
 * Resolves a collection of Intern test environments to a list of service
 * environments
 *
 * @param capabilities a base set of capabilities for all environments
 * @param environments a list of user-requested enviromnents
 * @param available a list of available environments
 * @returns a list of flattened service environments
 */
export default function resolveEnvironments(
  capabilities: { [key: string]: any },
  environments: EnvironmentOptions[],
  available?: NormalizedEnvironment[]
) {
  // Pre-process the environments list to resolve any uses of {pwd} and do any
  // top-level substitutions
  environments = environments.map(expandPwd).map(normalizeVersion);

  if (available) {
    environments = normalizeBrowserNames(environments, available);
  }

  // Update the browserName to match the target environment (only relevant for
  // edge / MicrosoftEdge)

  // flatEnviroments will have non-array versions
  const flatEnvironments = createPermutations(capabilities, environments);

  // Expand any version ranges or aliases in the environments.
  const expandedEnvironments = flatEnvironments.map(function(environment) {
    const browserVersion = resolveVersions(environment, available);
    if (browserVersion == null) {
      return environment;
    }
    return {
      ...environment,
      browserVersion,
      version: browserVersion
    };
  });

  // Perform a second round of permuting to handle any expanded version ranges
  return createPermutations({}, expandedEnvironments).map(
    environment => new Environment(environment)
  );
}

export interface EnvironmentOptions {
  browserName: string | string[];
  version?: string | string[] | number | number[];
  [key: string]: any;
}

export interface FlatEnvironment {
  browserName: string;
  version?: string;
  [key: string]: any;
}

/**
 * Expands {pwd} placeholders in a value. The value is assumed to be a string,
 * simple object, or array of strings or simple objects.
 */
function expandPwd<T>(value: T): T {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string' && /{pwd}/.test(value)) {
    return <any>normalize(value.replace(/{pwd}/g, process.cwd()));
  }

  if (Array.isArray(value)) {
    return <any>value.map(expandPwd);
  }

  if (typeof value === 'object') {
    return <any>Object.keys(value).reduce(
      (newObj, key) => ({
        ...newObj,
        [key]: expandPwd((<any>value)[key])
      }),
      {}
    );
  }

  return value;
}

/**
 * Ensure environment has both `version` and `browserVersion` properties with
 * the same value
 */
function normalizeVersion(env: EnvironmentOptions) {
  const browserVersion = env.browserVersion || env.version;
  return {
    ...env,
    browserVersion,
    version: browserVersion
  };
}

/**
 * Expands a range of versions using available environments
 */
function expandVersionRange(
  left: string,
  right: string,
  availableVersions: string[]
) {
  if (
    availableVersions.indexOf(left) === -1 ||
    availableVersions.indexOf(right) === -1
  ) {
    throw new Error(
      'The version range ' + left + '..' + right + ' is unavailable'
    );
  }
  return availableVersions.filter(function(version) {
    return version >= left && version <= right;
  });
}

/**
 * Resolves a version alias from a list of available versions.
 *
 * Assumes availableVersions is sorted in ascending order. Acceptable versions
 * are:
 *
 * * '{number}'
 * * 'latest'
 * * 'latest-{number}'
 */
function resolveVersionAlias(version: string, availableVersions: string[]) {
  // The version 'insider preview' is used for Edge Chromium (at least until
  // it's officially released).
  if (version === 'insider preview') {
    // If there are available versions and 'insider preview' isn't one of them,
    // throw an error. If there are no available versions, assume we're running
    // on a local Selenium server so the version doesn't matter.
    if (
      availableVersions.length > 0 &&
      availableVersions.indexOf(version) === -1
    ) {
      throw new Error(`"${version}" is not available`);
    }
    return version;
  }

  let pieces = version.split('-');
  if (pieces.length > 2) {
    throw new Error('Invalid alias syntax "' + version + '"');
  }

  pieces = pieces.map(function(piece) {
    return piece.trim();
  });

  if (
    (pieces.length === 2 &&
      (pieces[0] !== 'latest' || isNaN(Number(pieces[1])))) ||
    (pieces.length === 1 && isNaN(Number(pieces[0])) && pieces[0] !== 'latest')
  ) {
    throw new Error('Invalid alias syntax "' + version + '"');
  }

  if (pieces[0] === 'latest') {
    // Only consider numeric versions; we don't want 'beta' or 'dev'
    const numericVersions = availableVersions
      .filter(version => !isNaN(Number(version)))
      .sort((a, b) => Number(a) - Number(b));

    let offset = pieces.length === 2 ? Number(pieces[1]) : 0;
    if (offset > numericVersions.length) {
      throw new Error(
        `Can't get ${version}; ${numericVersions.length} version${
          numericVersions.length !== 1 ? 's are' : ' is'
        } available`
      );
    }

    return numericVersions[numericVersions.length - 1 - offset];
  } else {
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

  return versions.map(function(version) {
    return version.trim();
  });
}

/**
 * Get a list of versions from a list of available environments filtered by the
 * current environment.
 *
 * @param environment the environment for which versions should match
 * @param available a list of available environments
 * @returns a list of version numbers from available filtered by the current
 * environment
 */
function getVersions(
  environment: EnvironmentOptions,
  available: NormalizedEnvironment[]
): string[] {
  let versions: { [key: string]: boolean } = {};

  available
    .filter(function(availableEnvironment) {
      // Return true if there are no mismatching keys
      return !Object.keys(environment)
        // Don't match on version since we want all the available versions where
        // all the other keys match. Don't match 'browser' since we'll always
        // have 'browserName'.
        .filter(
          key =>
            key !== 'browserVersion' && key !== 'version' && key !== 'browser'
        )
        .some(envKey => {
          const key = <keyof NormalizedEnvironment>envKey;
          if (!(key in availableEnvironment)) {
            return false;
          }

          const value = environment[key];

          // At least BrowserStack uses 'edge' for MicrosoftEdge, while everyone
          // else + the Edge webdrivers use 'MicrosoftEdge'.
          if (key === 'browserName' && value === 'MicrosoftEdge') {
            return (
              availableEnvironment[key] !== 'MicrosoftEdge' ||
              availableEnvironment[key] !== 'edge'
            );
          }

          return availableEnvironment[key] !== value;
        });
    })
    .forEach(function(availableEnvironment) {
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
 * Resolves version aliases (e.g. latest, latest - 1) and version ranges (e.g.
 * 36 .. latest or latest - 3 .. latest) using the environment list returned by
 * tunnel#getEnvironments().
 *
 * @param environment an object with an optional version property
 * @param available a list of environment available on the target service
 * @returns the environment with resolved version aliases
 */
function resolveVersions(
  environment: FlatEnvironment,
  available?: NormalizedEnvironment[]
): string | string[] | undefined {
  let versionSpec = environment.version;
  let versions: string[];
  available = available || [];

  if (versionSpec && isNaN(Number(versionSpec))) {
    let availableVersions = getVersions(environment, available);

    versions = splitVersions(versionSpec).map(function(version) {
      const resolved = resolveVersionAlias(version, availableVersions);
      if (resolved == null) {
        throw new Error(
          `Unable to resolve version "${version}" for ${environment.browserName}. Are you using the proper browser and platform names for the tunnel?`
        );
      }
      return resolved;
    });

    if (versions.length === 2) {
      if (
        versions[0] === 'insider preview' ||
        versions[1] === 'insider preview'
      ) {
        throw new Error('"insider preview" cannot be used in a version range');
      }

      if (versions[0] > versions[1]) {
        throw new Error(
          'Invalid range [' + versions + '], must be in ascending order'
        );
      }

      versions = expandVersionRange(
        versions[0],
        versions[1],
        availableVersions
      );
    }

    return versions;
  }

  return versionSpec;
}

/**
 * Builds permutations of an object by flattening properties holding array
 * values into a collection of objects representing all combinations of objects
 * for all arrays in the object.
 *
 * @param base a base set of properties applied to each source
 * @param sources a list of sources to flatten
 * @return a flattened collection of sources
 */
function createPermutations(
  base: { [key: string]: string },
  sources?: EnvironmentOptions[]
): FlatEnvironment[] {
  // If no expansion sources were given, the set of permutations consists of
  // just the base
  if (!sources || sources.length === 0) {
    return [<FlatEnvironment>{ ...base }];
  }

  // Expand the permutation set for each source
  return sources
    .map(function(source) {
      return Object.keys(source).reduce(
        (permutations: FlatEnvironment[], key: string) => {
          if (Array.isArray(source[key])) {
            // For array values, create a copy of the permutation
            // set for each array item, then use the combination of
            // these copies as the new value of `permutations`
            permutations = source[key]
              .map((value: any) =>
                permutations.map(permutation => ({
                  ...permutation,
                  [key]: value
                }))
              )
              .reduce(
                (newPermutations: object[], keyPermutations: object[]) =>
                  newPermutations.concat(keyPermutations),
                []
              );
          } else {
            // For simple values, add the value to all current
            // permutations
            permutations.forEach(permutation => {
              permutation[key] = source[key];
            });
          }
          return permutations;
        },
        [<FlatEnvironment>{ ...base }]
      );
    })
    .reduce(
      (newPermutations, sourcePermutations) =>
        newPermutations.concat(sourcePermutations),
      []
    );
}

function normalizeBrowserNames(
  environments: EnvironmentOptions[],
  available: NormalizedEnvironment[]
) {
  return environments.map(env => {
    if (env.browserName === 'MicrosoftEdge') {
      if (available.some(ae => ae.browserName === 'edge')) {
        return {
          ...env,
          browserName: 'edge',
          browser: 'edge'
        };
      }
    }
    return env;
  });
}
