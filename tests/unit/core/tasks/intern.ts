import { mockImport } from 'tests/support/mockUtil';
import sinon from 'sinon';

registerSuite('core/tasks/intern', function() {
  const sandbox = sinon.createSandbox();

  let mockDone: sinon.SinonSpy<any[], void>;

  function setupDone() {
    return new Promise(resolve => {
      mockDone = sinon.spy((..._args: any[]) => resolve());
    });
  }

  const mockGrunt = {
    registerMultiTask: sandbox.stub(),
    async: sandbox.spy(() => mockDone),
    options: sandbox.stub()
  };

  const mockRun = sandbox.stub();
  const mockConfigure = sandbox.stub();

  const mockLoadConfig = sandbox.stub().resolves({});
  const mockCreateConfigurator = sandbox.spy((_props?: object) => ({
    addToConfig(_args: object, _config?: object) {
      return {};
    },

    describeConfig(_file: string, _prefix?: string): Promise<string> {
      return Promise.resolve('');
    },

    loadConfig: mockLoadConfig
  }));

  class MockNode {
    run: Function;
    configure: Function;
    constructor() {
      executors.push(this);
      this.run = mockRun;
      this.configure = mockConfigure;
    }
  }

  let gruntTask: typeof import('src/tasks/intern');
  let executors: MockNode[];

  return {
    async before() {
      gruntTask = await mockImport(
        // The intern Grunt task uses commonJS export semantics
        () => require('src/tasks/intern'),
        replace => {
          replace(() => import('src/core/lib/executors/Node')).withDefault(
            MockNode as any
          ),
            replace(() => import('src/common')).with({ global: {} });
          replace(() => import('src/core/lib/node/config')).with({
            createConfigurator: mockCreateConfigurator
          });
        }
      );
    },

    beforeEach() {
      sandbox.reset();
      mockRun.resolves();
      executors = [];
    },

    tests: {
      'task registration'() {
        gruntTask(<any>mockGrunt);

        assert.equal(
          mockGrunt.registerMultiTask.callCount,
          1,
          'task should have registered'
        );
        assert.equal(
          mockGrunt.registerMultiTask.getCall(0).args[0],
          'intern',
          'unexpected task name'
        );
      },

      'run task': {
        config() {
          mockGrunt.registerMultiTask.callsArgOn(1, mockGrunt);
          mockGrunt.options.returns({
            config: '@coverage',
            foo: 'bar'
          });
          mockLoadConfig.resolves({
            spam: 'ham'
          });
          const done = setupDone();

          gruntTask(<any>mockGrunt);

          return done.then(() => {
            assert.lengthOf(
              executors,
              1,
              '1 executor should have been created'
            );
            assert.equal(mockRun.callCount, 1, 'intern should have been run');
            assert.equal(mockLoadConfig.callCount, 1);
            assert.equal(mockLoadConfig.getCall(0).args[0], '@coverage');
            assert.equal(mockConfigure.callCount, 2);
            assert.deepEqual(mockConfigure.getCall(0).args[0], {
              spam: 'ham'
            });
            assert.deepEqual(mockConfigure.getCall(1).args[0], {
              foo: 'bar'
            });
            assert.equal(mockDone.callCount, 1);
            // First arg is an error, so it should be undefined here
            assert.isUndefined(mockDone.getCall(0).args[0]);
          });
        },

        'no config'() {
          mockGrunt.registerMultiTask.callsArgOn(1, mockGrunt);
          mockGrunt.options.returns({
            foo: 'bar'
          });
          const done = setupDone();

          gruntTask(<any>mockGrunt);

          return done.then(() => {
            assert.lengthOf(
              executors,
              1,
              '1 executor should have been created'
            );
            assert.equal(mockRun.callCount, 1, 'intern should have been run');
            assert.equal(mockLoadConfig.callCount, 0);
            assert.equal(mockConfigure.callCount, 2);
            assert.deepEqual(mockConfigure.getCall(0).args[0], {});
            assert.deepEqual(mockConfigure.getCall(1).args[0], {
              foo: 'bar'
            });
            assert.equal(mockDone.callCount, 1);
            // First arg is an error, so it should be undefined here
            assert.isUndefined(mockDone.getCall(0).args[0]);
          });
        }
      },

      error() {
        mockGrunt.registerMultiTask.callsArgOn(1, mockGrunt);
        mockGrunt.options.returns({
          foo: 'bar'
        });
        const error = new Error('bad');
        mockRun.rejects(error);

        const done = setupDone();

        gruntTask(<any>mockGrunt);

        return done.then(() => {
          assert.lengthOf(executors, 1, '1 executor should have been created');
          assert.equal(mockRun.callCount, 1, 'intern should have been run');
          assert.equal(mockDone.callCount, 1);
          assert.equal(mockDone.getCall(0).args[0], error);
        });
      }
    }
  };
});
