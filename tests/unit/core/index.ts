import { mockImport } from '../../support/mockUtil';

const mockGlobal = Object.create(null);
class MockNode {}

registerSuite('core/index', {
  async before() {
    await mockImport(
      () => import('src/core/index'),
      replace => {
        replace(() => import('src/core/lib/executors/Node')).withDefault(
          MockNode as any
        );
        replace(() => import('src/common')).with({
          global: mockGlobal
        });
      }
    );
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
