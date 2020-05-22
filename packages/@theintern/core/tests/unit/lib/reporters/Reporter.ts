import { mockImport } from 'tests/support/mockUtil';
import { createSandbox, spy } from 'sinon';
import { global } from '@theintern/common';

import _Reporter, {
  createEventHandler,
  eventHandler,
} from 'src/lib/reporters/Reporter';
import Executor, { Events } from 'src/lib/executors/Executor';
import Test from 'src/lib/Test';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/Reporter', function () {
  const sandbox = createSandbox();

  const _mockExecutor = {
    formatError: sandbox.spy((_error: Error) => {}),
    on: sandbox.spy((_event: string, _listener: () => void) => {}),
  };
  const mockExecutor = (_mockExecutor as unknown) as Executor<any, any>;

  const mockGlobal: { [name: string]: any } = {};

  let Reporter: typeof _Reporter;

  return {
    async before() {
      ({ default: Reporter } = await mockImport(
        () => import('src/lib/reporters/Reporter'),
        (replace) => {
          replace(() => import('@theintern/common')).with({
            global: mockGlobal,
          });
        }
      ));
    },

    beforeEach() {
      sandbox.resetHistory();
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
            console: mockConsole,
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
        },
      },

      '#formatError'() {
        const reporter = new Reporter(mockExecutor);
        const error = new Error('foo');
        reporter.formatError(error);
        assert.equal(
          _mockExecutor.formatError.callCount,
          1,
          'expected executor error formatter to be called'
        );
        assert.strictEqual(_mockExecutor.formatError.getCall(0).args[0], error);
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
        assert.equal(_mockExecutor.on.callCount, 1);
        assert.equal(_mockExecutor.on.getCall(0).args[0], 'testStart');

        const listener = _mockExecutor.on.getCall(0).args[1];
        listener();
        assert.isTrue(started, 'testStart event should have been handled');
      },

      'custom event handler'() {
        interface SomeEvents extends Events {
          goodTime: string;
          badTime: string;
        }
        const customEventHandler = createEventHandler<SomeEvents>();

        const evented: string[] = [];
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
        assert.equal(_mockExecutor.on.callCount, 2);
        assert.equal(_mockExecutor.on.getCall(0).args[0], 'goodTime');
        assert.equal(_mockExecutor.on.getCall(1).args[0], 'badTime');

        const goodListener = _mockExecutor.on.getCall(0).args[1];
        goodListener();
        const badListener = _mockExecutor.on.getCall(1).args[1];
        badListener();
        assert.deepEqual(
          evented,
          ['good', 'bad'],
          'funTime event should have been handled'
        );
      },
    },
  };
});
