const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let removeMocks: () => void;
let mockGlobal = Object.create(null);

class MockNode {}

registerSuite('core/index', {
  before() {
    return mockRequire(require, 'src/core/index', {
      'src/core/lib/executors/Node': MockNode,
      'src/common': { global: mockGlobal }
    }).then(resource => {
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
    }
  }
});
