import Simple from 'src/core/lib/reporters/Simple';
import {
  createMockNodeExecutor,
  MockConsole,
  createMockConsole
} from 'tests/support/unit/mocks';

let mockConsole: MockConsole;
let reporter: Simple;

registerSuite('src/core/lib/reporters/Simple', {
  beforeEach() {
    mockConsole = createMockConsole();
    const mockExecutor = createMockNodeExecutor();
    reporter = new Simple(mockExecutor, {
      console: <any>mockConsole
    });
  },

  tests: {
    error() {
      reporter.error(new Error('Oops'));
      assert.deepEqual(mockConsole.error.args, [['Error: Oops']]);
    },

    log() {
      reporter.log('This is\na test');
      assert.deepEqual(mockConsole.log.args, [
        ['DEBUG: This is'],
        ['DEBUG: a test']
      ]);
    },

    suiteEnd: {
      error() {
        reporter.suiteEnd(<any>{ error: new Error('foo') });
        assert.deepEqual(mockConsole.warn.args, [['SUITE ERROR']]);
        assert.deepEqual(mockConsole.error.args, [['Error: foo']]);
      },

      normal: {
        'failing tests'() {
          reporter.suiteEnd(<any>{
            numTests: 2,
            numFailedTests: 1,
            numSkippedTests: 0
          });
          assert.deepEqual(mockConsole.warn.args, [['1/2 tests failed']]);
        },

        'passing tests'() {
          reporter.suiteEnd(<any>{
            name: 'foo',
            numTests: 2,
            numFailedTests: 0,
            numSkippedTests: 1
          });
          assert.deepEqual(mockConsole.info.args, [
            ['0/2 tests failed in foo (1 skipped)']
          ]);
        }
      }
    },

    testEnd: {
      failed() {
        reporter.testEnd(<any>{
          id: 'foo',
          timeElapsed: 123,
          error: new Error('failed')
        });
        assert.deepEqual(mockConsole.error.args, [
          ['FAIL: foo (123ms)'],
          ['Error: failed']
        ]);
      },

      skipped() {
        reporter.testEnd(<any>{ id: 'foo', skipped: 'yes' });
        assert.deepEqual(mockConsole.log.args, [['SKIP: foo (yes)']]);
      },

      passed() {
        reporter.testEnd(<any>{ id: 'foo', timeElapsed: 123 });
        assert.deepEqual(mockConsole.log.args, [['PASS: foo (123ms)']]);
      }
    }
  }
});
