import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import * as main from '../../src/main';

registerSuite({
	name: 'intern/main',

	'initial state'() {
		assert.isFunction(main.load, 'main.load should be a function');
		assert.property(main, 'executor', 'main should have an executor property');
	}
});
