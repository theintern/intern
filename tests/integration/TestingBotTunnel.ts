import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import TestingBotTunnel from 'src/TestingBotTunnel';

function checkEnvironment(environment: any) {
	assert.property(environment, 'selenium_name');
	assert.property(environment, 'name');
	assert.property(environment, 'platform');
	assert.property(environment, 'version');
}

const suite = {
	name: 'integration/TestingBotTunnel'
};

addEnvironmentTest(suite, TestingBotTunnel, checkEnvironment);
addStartStopTest(suite, TestingBotTunnel, { timeout: 30000 });

registerSuite(suite);
