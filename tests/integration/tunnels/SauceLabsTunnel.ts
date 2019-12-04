import {
  addEnvironmentTest,
  addStartStopTest
} from 'tests/support/integration';
import SauceLabsTunnel from 'src/tunnels/SauceLabsTunnel';

function checkEnvironment(environment: any) {
  assert.property(environment, 'short_version');
  assert.property(environment, 'api_name');
  assert.property(environment, 'os');
}

let suite = {};
suite = addEnvironmentTest(suite, SauceLabsTunnel, checkEnvironment);
suite = addStartStopTest(suite, SauceLabsTunnel, {
  timeout: 120000
});

registerSuite('integration/SauceLabsTunnel', suite);
