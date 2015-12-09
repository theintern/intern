import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import * as tdd from '../../../../lib/interfaces/tdd';
import * as bdd from '../../../../lib/interfaces/bdd';

registerSuite({
	name: 'intern/lib/interfaces/bdd',

	// We already test all the BDD code paths by testing TDD, so long as the methods are the same, so just
	// make sure that they are actually the same
	'BDD/TDD interface equivalence check'() {
		assert.strictEqual(tdd.suite, bdd.describe, 'bdd.describe should be an alias for tdd.suite');
		assert.strictEqual(tdd.test, bdd.it, 'bdd.it should be an alias for tdd.test');

		for (let key in { before: 1, after: 1, beforeEach: 1, afterEach: 1 }) {
			assert.strictEqual((<any> tdd)[key], (<any> bdd)[key], 'bdd.' + key + ' should be an alias for tdd.' + key);
		}
	}
});
