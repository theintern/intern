import registerSuite = require('intern!object');
import { assert } from 'chai';
import * as main from '../../main';

registerSuite({
	name: 'intern/main',

	'initial state': function () {
		assert.isFunction(main.load, 'main.load should be a function');
		assert.property(main, 'executor', 'main should have an executor property');
	}
});
