import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { EnvironmentType } from '../../../src/lib/EnvironmentType';

registerSuite({
	name: 'intern/lib/EnvironmentType',

	'constructor with info'() {
		const type = new EnvironmentType({
			browserName: 'Browser',
			version: '1.0',
			platform: 'Platform',
			platformVersion: '2.0'
		});

		assert.strictEqual(type.toString(), 'Browser 1.0 on Platform 2.0');
	},

	'constructor missing info'() {
		const type = new EnvironmentType({});
		assert.strictEqual(type.toString(), 'Any browser on any platform');
	}
});
