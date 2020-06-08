import { rm } from 'shelljs';
import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import CrossBrowserTestingTunnel from '../../src/CrossBrowserTestingTunnel';

function checkEnvironment(environment: any) {
  assert.property(environment, 'api_name');
  assert.nestedProperty(environment, 'browsers.0.api_name');
}

let tests = {};
tests = addEnvironmentTest(tests, CrossBrowserTestingTunnel, checkEnvironment, {
  needsAuthData: true
});
tests = addStartStopTest(tests, CrossBrowserTestingTunnel, {
  timeout: 120000
});

const suite = {
  before() {
    rm('-rf', 'node_modules/cbt_tunnels');
  },

  tests
};

registerSuite('integration/CrossBrowserTestingTunnel', suite);
