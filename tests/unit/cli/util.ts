import {
  acceptVersion,
  collect,
  copy,
  die,
  enumArg,
  _setDieMethod
} from 'src/cli/lib/util';
import { mkdirSync, readdirSync, rmdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/util', {
  acceptVersion() {
    assert.isTrue(acceptVersion('3.3.0-pre', '3.0.0'));
    assert.isTrue(acceptVersion('3.3.2', '3.0.0'));
    assert.isFalse(acceptVersion('2.3.2', '3.0.0'));
  },

  collect() {
    const input: string[] = [];
    collect('5', input);
    assert.deepEqual(input, ['5']);

    collect('6', input);
    assert.deepEqual(input, ['5', '6']);
  },

  copy: (() => {
    function rm(name: string) {
      if (statSync(name).isDirectory()) {
        readdirSync(name).forEach(function(filename) {
          rm(join(name, filename));
        });
        rmdirSync(name);
      } else {
        unlinkSync(name);
      }
    }

    let tempdir: string;

    return {
      before() {
        mkdirSync('.testtmp');
        tempdir = '.testtmp';
      },

      afterEach() {
        readdirSync(tempdir).forEach(function(filename: string) {
          rm(join(tempdir, filename));
        });
      },

      after() {
        rm(tempdir);
      },

      tests: {
        'copy file'() {
          copy('./tests/util.ts', join(tempdir, 'util.js'));
          assert.isTrue(statSync(join(tempdir, 'util.js')).isFile());
        },

        'copy dir'() {
          copy('./tests', tempdir);
          assert.isTrue(statSync(join(tempdir, 'util.ts')).isFile());
        }
      }
    };
  })(),

  enumArg: (() => {
    const oldDie = die;
    let message: string | null;

    return {
      before() {
        _setDieMethod(function(msg: string) {
          message = msg;
        });
      },

      beforeEach() {
        message = null;
      },

      after() {
        _setDieMethod(oldDie);
      },

      tests: {
        good() {
          assert.strictEqual(enumArg(['a', 'b'], 'a'), 'a');
          assert.isNull(message);
        },

        bad() {
          enumArg(['a', 'b'], 'c');
          assert.isNotNull(message);
        }
      }
    };
  })()
});
