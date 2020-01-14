import {
  addEnvironmentTest,
  addStartStopTest
} from 'tests/support/integration';
import TestingBotTunnel from 'src/tunnels/TestingBotTunnel';

function checkEnvironment(environment: any) {
  assert.property(environment, 'selenium_name');
  assert.property(environment, 'name');
  assert.property(environment, 'platform');
  assert.property(environment, 'version');
}

let suite = {};
suite = addEnvironmentTest(suite, TestingBotTunnel, checkEnvironment, {
  needsAuthData: true
});
suite = addStartStopTest(suite, TestingBotTunnel, { timeout: 60000 });

registerSuite('integration/tunnels/TestingBotTunnel', suite);
