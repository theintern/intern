import * as bddInt from 'src/core/lib/interfaces/bdd';
import * as tddInt from 'src/core/lib/interfaces/tdd';

registerSuite('lib/interfaces/bdd', {
  // Since this interface is the same as tdd, just check that it really is the
  // same
  'tdd equivalence'() {
    assert.strictEqual(
      bddInt.describe,
      tddInt.suite,
      'expected bdd describe to alias tdd suite'
    );
    assert.strictEqual(
      bddInt.it,
      tddInt.test,
      'expected bdd it to alias tdd test'
    );
    assert.strictEqual(
      bddInt.before,
      tddInt.before,
      'expected bdd before to alias tdd before'
    );
    assert.strictEqual(
      bddInt.after,
      tddInt.after,
      'expected bdd after to alias tdd after'
    );
    assert.strictEqual(
      bddInt.beforeEach,
      tddInt.beforeEach,
      'expected bdd beforeEach to alias tdd beforeEach'
    );
    assert.strictEqual(
      bddInt.afterEach,
      tddInt.afterEach,
      'expected bdd afterEach to alias tdd afterEach'
    );

    assert.isUndefined(
      (<any>bddInt).test,
      'bdd interface should not have test'
    );
    assert.isUndefined(
      (<any>bddInt).suite,
      'bdd interface should not have suite'
    );
  },

  getInterface() {
    const iface = bddInt.getInterface(<any>{});
    assert.isFunction(
      iface.describe,
      'expected describe to exist on interface'
    );
    assert.isFunction(iface.it, 'expected it to exist on interface');
    assert.isFunction(iface.before, 'expected before to exist on interface');
    assert.isFunction(iface.after, 'expected after to exist on interface');
    assert.isFunction(
      iface.beforeEach,
      'expected beforeEach to exist on interface'
    );
    assert.isFunction(
      iface.afterEach,
      'expected afterEach to exist on interface'
    );
  }
});
