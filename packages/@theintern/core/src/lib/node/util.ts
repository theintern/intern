import { existsSync, mkdirSync, readFileSync } from 'fs';
import { hasMagic, sync as glob } from 'glob';
import { dirname, extname, join, normalize, sep } from 'path';
import { RawSourceMap } from 'source-map';
import { sync as nodeResolve } from 'resolve';

/**
 * Expand a list of glob patterns into a flat file list. Patterns may be simple
 * file paths or glob patterns. Patterns starting with '!' denote exclusions.
 * Note that exclusion rules will not apply to simple paths.
 */
export function expandFiles(patterns?: string[] | string, basePath?: string) {
  if (!patterns) {
    patterns = [];
  } else if (!Array.isArray(patterns)) {
    patterns = [patterns];
  }

  if (!basePath) {
    basePath = process.cwd();
  }

  const excludes: string[] = [];
  const includes: string[] = [];
  const paths: string[] = [];

  for (const pattern of patterns) {
    if (pattern[0] === '!') {
      excludes.push(pattern.slice(1));
    } else {
      if (hasMagic(pattern)) {
        includes.push(pattern);
      } else {
        paths.push(pattern);
      }
    }
  }

  const allPaths = includes
    .map((pattern) => glob(pattern, { ignore: excludes, cwd: basePath }))
    .reduce((allFiles, files) => allFiles.concat(files), paths);
  const uniquePaths: { [name: string]: boolean } = {};
  allPaths.forEach((path) => (uniquePaths[path] = true));

  return Object.keys(uniquePaths);
}

/**
 * Return the default base path
 */
export function getDefaultBasePath() {
  return process.cwd() + sep;
}

/**
 * Return the default internPath
 */
export function getDefaultInternPath() {
  let internPath = dirname(dirname(dirname(__dirname)));

  // If internPath isn't under cwd, intern is most likely symlinked into the
  // project's node_modules. In that case, use the package location as resolved
  // from the project root.
  if (internPath.indexOf(process.cwd()) !== 0) {
    // nodeResolve will resolve to dist/index.js; we want the base intern
    // directory
    internPath = dirname(
      dirname(
        nodeResolve('@theintern/core', {
          basedir: process.cwd(),
        })
      )
    );
  }

  return internPath;
}

// TODO: Remove in the next version
/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
  return normalize(path).replace(/\\/g, '/');
}

/**
 * Given a source filename, and optionally code, return the file's source map if
 * one exists.
 */
export function readSourceMap(
  sourceFile: string,
  code?: string
): RawSourceMap | undefined {
  if (!code) {
    code = readFileSync(sourceFile, { encoding: 'utf8' });
  }

  let match: RegExpMatchArray | null;

  // sourceMappingUrl must be on last line of source file; search for last
  // newline from code.length - 2 in case the file ends with a newline
  const lastNewline = code.lastIndexOf('\n', code.length - 2);
  const lastLine = code.slice(lastNewline + 1);

  if ((match = sourceMapRegEx.exec(lastLine))) {
    if (match[1]) {
      return JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
    } else {
      // Treat map file path as relative to the source file
      const mapFile = join(dirname(sourceFile), match[2]);
      return JSON.parse(readFileSync(mapFile, { encoding: 'utf8' }));
    }
  }
}

/**
 * Indicate whether a value is an ErrnoException
 */
export function isErrnoException(value: any): value is NodeJS.ErrnoException {
  return value.errno !== null;
}

/**
 * Recursively create directories
 */
export function mkdirp(dir: string) {
  const parent = dirname(dir);
  if (parent && !existsSync(parent)) {
    mkdirp(parent);
  }
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
}

export function transpileSource(filename: string, code: string) {
  require.extensions[extname(filename)](
    {
      _compile(source: string) {
        code = source;
      },
    } as any,
    filename
  );

  return code;
}

// Regex for matching sourceMappingUrl comments
const sourceMapRegEx = /^(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;

/**
 * @returns if the path has a TypeScript file extension
 */
export function isTypeScriptFile(path: string) {
  return path.endsWith('.ts') || path.endsWith('.tsx');
}
