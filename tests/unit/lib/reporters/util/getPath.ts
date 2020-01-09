import { getPath } from 'src/lib/reporters/util/getPath';
import { join } from 'path';

const DIR = 'directory';
const FILE = 'file.name';

registerSuite('lib/reporters/util/getPath', {
  tests: {
    'getPath()': {
      'no parameters; returns undefined'() {
        assert.isUndefined(getPath());
      },

      'directory only; returns directory'() {
        assert.strictEqual(getPath(DIR), DIR);
      },

      'directory and filename; returns joined path'() {
        assert.strictEqual(getPath(DIR, FILE), join(DIR, FILE));
      },

      'directory and defaultFilename; returns joined path'() {
        assert.strictEqual(getPath(DIR, undefined, FILE), join(DIR, FILE));
      },

      'filename only; returns filename'() {
        assert.strictEqual(getPath(undefined, FILE), FILE);
      },

      'defaultFilename only; returns undefined'() {
        assert.isUndefined(getPath(undefined, undefined, FILE));
      }
    }
  }
});
