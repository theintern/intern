/**
 * Get the parent directory name of a path
 */
export function dirname(path: string) {
  const sep = getPathSep(path);
  const parts = normalize(path).split('/');
  parts.pop();
  if (parts.length === 1 && parts[0] === '') {
    return sep;
  }
  return parts.join(sep);
}

/**
 * Get the path separator used for a given set of paths.
 */
export function getPathSep(...paths: string[]) {
  return paths.some(path => /\\/.test(path)) ? '\\' : '/';
}

/**
 * Join a set of paths, resolving any relative segments (. or ..) in subsequent
 * paths against the first path.
 */
export function join(...paths: string[]) {
  const sep = getPathSep(...paths);
  const normalPaths = paths.map(normalize);
  const basePathParts = normalPaths[0].split('/');

  if (
    basePathParts.length > 1 &&
    basePathParts[basePathParts.length - 1] === ''
  ) {
    basePathParts.pop();
  }

  for (const path of normalPaths.slice(1)) {
    for (const part of path.split('/')) {
      if (part === '..') {
        basePathParts.pop();
      } else if (part !== '.') {
        basePathParts.push(part);
      }
    }
  }
  return basePathParts.join(sep);
}

/**
 * Normalize a path, replacing any occurrences of '\' with '/'
 */
export function normalize(path: string) {
  return path.replace(/\\/g, '/');
}

/**
 * Normalize a path such that it ends with a path separator
 */
export function normalizePathEnding(path: string, pathSep = '/') {
  if (path && path.length > 0 && path[path.length - 1] !== pathSep) {
    return `${path}${pathSep}`;
  }
  return path;
}
