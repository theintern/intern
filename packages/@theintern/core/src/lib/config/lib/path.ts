import { getPathSep, join, normalize } from '../../common/path';

const configPathSeparator = '@';

/**
 * Get the base path based on a config file path and a user-supplied base path.
 *
 * The path separator will be normalized based on the separator used in
 * configFile or basePath and the optional pathSep arg.
 */
export function getBasePath(
  configFile: string,
  basePath: string | undefined,
  isAbsolute: (path: string) => boolean,
  pathSep?: string
) {
  pathSep = pathSep || getPathSep(configFile, basePath || '');

  // initialBasePath is the path containing the config file
  const configPathParts = configFile.replace(/\\/g, '/').split('/');
  let initialBasePath: string;

  if (configFile[0] === '/' && configPathParts.length === 2) {
    initialBasePath = '/';
  } else {
    initialBasePath = configPathParts.slice(0, -1).join('/');
  }

  let finalBasePath: string;

  if (basePath) {
    basePath = normalize(basePath);

    if (isAbsolute(basePath)) {
      // basePath is absolute, so use it directly
      finalBasePath = basePath;
    } else {
      // basePath is relative, so resolve it against initialBasePath
      finalBasePath = join(initialBasePath, basePath);
    }
  } else {
    // No basePath was provided, so use initialBasePath
    finalBasePath = initialBasePath;
  }

  return finalBasePath.split('/').join(pathSep);
}

/**
 * Split a config path into a file name and a child config name.
 *
 * This allows for the case where a file name itself may include the config
 * separator (e.g., a scoped npm package).
 */
export function splitConfigPath(
  path: string,
  separator = '/'
): { configFile: string; childConfig?: string } {
  const lastSep = path.lastIndexOf(configPathSeparator);
  if (lastSep === 0) {
    // path is like '@foo' -- specifies a child config
    return { configFile: '', childConfig: path.slice(1) };
  }
  if (lastSep === -1 || path[lastSep - 1] === separator) {
    // path is like 'foo' or 'node_modules/@foo' -- specifies a
    // path
    return { configFile: path };
  }

  // path is like 'foo@bar' or 'node_modules/@foo@bar' -- specifies a path and
  // a child config
  return {
    configFile: path.slice(0, lastSep),
    childConfig: path.slice(lastSep + 1)
  };
}
