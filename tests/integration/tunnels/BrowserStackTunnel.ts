import {
  addEnvironmentTest,
  addStartStopTest
} from 'tests/support/integration';
import BrowserStackTunnel from 'src/tunnels/BrowserStackTunnel';

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

registerSuite('integration/BrowserStackTunnel', suite);
