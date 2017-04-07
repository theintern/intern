import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import CrossBrowserTestingTunnel from 'src/CrossBrowserTestingTunnel';

function checkEnvironment(environment: any) {
	assert.property(environment, 'api_name');
	assert.deepProperty(environment, 'browsers.0.api_name');
}

const suite = {
	name: 'integration/CrossBrowserTestingTunnel'
};

addEnvironmentTest(suite, CrossBrowserTestingTunnel, checkEnvironment, {
	needsAuthData: true
});
addStartStopTest(suite, CrossBrowserTestingTunnel);

registerSuite(suite);
