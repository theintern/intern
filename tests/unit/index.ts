const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let removeMocks: () => void;
let mockGlobal = Object.create(null);

class MockNode {}

registerSuite('index', {
  before() {
    return mockRequire(require, 'src/index', {
      'src/lib/executors/Node': MockNode,
      '@theintern/common': { global: mockGlobal },
    }).then((resource) => {
      removeMocks = resource.remove;
    });
  },

  after() {
    removeMocks();
  },

  tests: {
    'global defined'() {
      assert.isDefined(
        mockGlobal.intern,
        'expected intern global to have been defined'
      );
    },
  },
});
