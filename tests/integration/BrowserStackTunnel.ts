import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import BrowserStackTunnel from 'src/BrowserStackTunnel';

function checkEnvironment(environment: any) {
	assert.property(environment, 'os_version');
	assert.property(environment, 'browser');
	assert.property(environment, 'os');
	assert.property(environment, 'device');
	assert.property(environment, 'browser_version');
}

const suite = {
	name: 'integration/BrowserStackTunnel'
};

addEnvironmentTest(suite, BrowserStackTunnel, checkEnvironment, {
	needsAuthData: true
});
addStartStopTest(suite, BrowserStackTunnel);

registerSuite(suite);
