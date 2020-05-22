import {
  addEnvironmentTest,
  addStartStopTest
} from '../support/integration';
import BrowserStackTunnel from '../../src/BrowserStackTunnel';

const { registerSuite } = intern.getPlugin("interface.object");
const { assert } = intern.getPlugin("chai");

function checkEnvironment(environment: any) {
  assert.property(environment, 'os_version');
  assert.property(environment, 'browser');
  assert.property(environment, 'os');
  assert.property(environment, 'device');
  assert.property(environment, 'browser_version');
}

let suite = {};
suite = addEnvironmentTest(suite, BrowserStackTunnel, checkEnvironment, {
  needsAuthData: true
});
suite = addStartStopTest(suite, BrowserStackTunnel);

registerSuite('integration/tunnels/BrowserStackTunnel', suite);
