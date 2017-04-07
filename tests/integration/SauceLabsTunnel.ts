import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import SauceLabsTunnel from 'src/SauceLabsTunnel';

function checkEnvironment(environment: any) {
	assert.property(environment, 'short_version');
	assert.property(environment, 'api_name');
	assert.property(environment, 'os');
}

const suite = {
	name: 'integration/SauceLabsTunnel'
};

addEnvironmentTest(suite, SauceLabsTunnel, checkEnvironment);
addStartStopTest(suite, SauceLabsTunnel, {
	timeout: 120000
});

registerSuite(suite);
