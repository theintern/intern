import { join } from 'path';

/**
 * This method helps to normalize the rules surrounding LEGACY reporters.
 *
 * DO NOT use this method when writing new Reporters. New reporters should ALWAYS require a directory
 * and if needed an optional filename. If the filename is not provided, but necessary, then a default
 * should be assigned by the reporter.
 *
 * getPath() normalizes legacy Reporters following these rules:
 *
 * 1. If a directory exists:
 * 1a. and a filename exists; return the joined directory and filename
 * 1b. and a default filename exists; return the joined directory and default filename
 * 1c. return just the directory
 * 2. If a filename exists; return just the filename as a full path
 * 3. If no conditions are met, return undefined
 *
 * The defaultFilename exists as a separate parameter so it is only used when a directory exists.
 */
export function getPath(
  directory?: string,
  filename?: string,
  defaultFilename?: string
) {
  if (directory) {
    if (filename) {
      return join(directory, filename);
    } else if (defaultFilename) {
      return join(directory, defaultFilename);
    }

    return directory;
  } else if (filename) {
    return filename;
  }
}
