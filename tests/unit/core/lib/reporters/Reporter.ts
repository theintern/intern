import { spy } from 'sinon';
import { global } from 'src/common';

import _Reporter, {
  createEventHandler,
  eventHandler
} from 'src/core/lib/reporters/Reporter';
import { Events } from 'src/core/lib/executors/Executor';
import Test from 'src/core/lib/Test';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/reporters/Reporter', function() {
  const mockExecutor = <any>{
    formatError: spy(() => {}),
    on: spy(() => {})
  };

  const mockGlobal: { [name: string]: any } = {};

  let Reporter: typeof _Reporter;
  let removeMocks: () => void;

  return {
    before() {
      return mockRequire(require, 'src/core/lib/reporters/Reporter', {
        'src/common': { global: mockGlobal }
      }).then(handle => {
        removeMocks = handle.remove;
        Reporter = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      mockExecutor.formatError.reset();
      mockExecutor.on.reset();
      if (global.process != null) {
        mockGlobal.process = global.process;
      }
    },

    tests: {
      construct() {
        const reporter = new Reporter(mockExecutor, {});
        assert.isDefined(reporter);
      },

      '#console'() {
        const reporter = new Reporter(mockExecutor, {});
        const defaultConsole = reporter.console;
        assert.isDefined(
          defaultConsole,
          'console should have been created on demand'
        );

        const custom = {};
        reporter.console = <any>custom;
        assert.strictEqual(
          reporter.console,
          custom,
          'console should be assignable'
        );
      },

      '#output': {
        custom() {
          const output = <any>{};
          const reporter = new Reporter(mockExecutor, { output });
          assert.strictEqual(reporter.output, output);
        },

        'default, process'() {
          const reporter = new Reporter(mockExecutor);
          mockGlobal.process = { stdout: {} };
          assert.strictEqual(reporter.output, mockGlobal.process.stdout);
        },

        'default, no process'() {
          mockGlobal.process = undefined;
          const reporter = new Reporter(mockExecutor);
          const output = reporter.output;
          assert.notStrictEqual(output, process.stdout);
          assert.property(output, 'write');
          assert.property(output, 'end');
        },

        write() {
          const dfd = this.async(undefined, 2);
          mockGlobal.process = undefined;
          const mockConsole = <any>{ log: spy(() => {}) };
          const reporter = new Reporter(mockExecutor, {
            console: mockConsole
          });
          assert.strictEqual<any>(reporter.console, mockConsole);
          const output = reporter.output;
          output.write(
            'foo',
            'utf8',
            dfd.callback(() => {
              assert.equal(mockConsole.log.callCount, 1);
              assert.equal(mockConsole.log.getCall(0).args[0], 'foo');
            })
          );
          output.end(
            'bar',
            'utf8',
            dfd.callback(() => {
              assert.equal(mockConsole.log.callCount, 2);
              assert.equal(mockConsole.log.getCall(1).args[0], 'bar');
            })
          );
        }
      },

      '#formatError'() {
        const reporter = new Reporter(mockExecutor);
        const error = new Error('foo');
        reporter.formatError(error);
        assert.equal(
          mockExecutor.formatError.callCount,
          1,
          'expected executor error formatter to be called'
        );
        assert.strictEqual(mockExecutor.formatError.getCall(0).args[0], error);
      },

      'event handlers'() {
        let started = false;
        class AReporter extends Reporter {
          @eventHandler()
          testStart(_test: Test) {
            started = true;
          }
        }
        new AReporter(mockExecutor);
        assert.equal(mockExecutor.on.callCount, 1);
        assert.equal(mockExecutor.on.getCall(0).args[0], 'testStart');

        const listener = mockExecutor.on.getCall(0).args[1];
        listener();
        assert.isTrue(started, 'testStart event should have been handled');
      },

      'custom event handler'() {
        interface SomeEvents extends Events {
          goodTime: string;
          badTime: string;
        }
        const customEventHandler = createEventHandler<SomeEvents>();

        let evented: string[] = [];
        class SomeReporter extends Reporter {
          @customEventHandler()
          goodTime(_data: string) {
            evented.push('good');
          }

          @customEventHandler()
          badTime(_data: string) {
            evented.push('bad');
          }
        }
        new SomeReporter(mockExecutor);
        assert.equal(mockExecutor.on.callCount, 2);
        assert.equal(mockExecutor.on.getCall(0).args[0], 'goodTime');
        assert.equal(mockExecutor.on.getCall(1).args[0], 'badTime');

        const goodListener = mockExecutor.on.getCall(0).args[1];
        goodListener();
        const badListener = mockExecutor.on.getCall(1).args[1];
        badListener();
        assert.deepEqual(
          evented,
          ['good', 'bad'],
          'funTime event should have been handled'
        );
      }
    }
  };
});
