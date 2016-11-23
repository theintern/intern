import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import * as tdd from '../../../../src/lib/interfaces/tdd';
import * as bdd from '../../../../src/lib/interfaces/bdd';

registerSuite({
	name: 'intern/lib/interfaces/bdd',

	// We already test all the BDD code paths by testing TDD, so long as the methods are the same, so just
	// make sure that they are actually the same
	'BDD/TDD interface equivalence check'() {
		assert.strictEqual(tdd.suite, bdd.describe, 'bdd.describe should be an alias for tdd.suite');
		assert.strictEqual(tdd.test, bdd.it, 'bdd.it should be an alias for tdd.test');

		const anyTdd = <any> tdd;
		const anyBdd = <any> bdd;
		for (let key in { before: 1, after: 1, beforeEach: 1, afterEach: 1 }) {
			assert.strictEqual(anyTdd[key], anyBdd[key], 'bdd.' + key + ' should be an alias for tdd.' + key);
		}

		assert.isUndefined(anyBdd.suite, 'bdd.suite should not be defined since it is a TDD interface');
		assert.isUndefined(anyBdd.test, 'bdd.test should not be defined since it is a TDD interface');
	}
});
