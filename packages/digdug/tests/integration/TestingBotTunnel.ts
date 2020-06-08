import { addEnvironmentTest, addStartStopTest } from '../support/integration';
import TestingBotTunnel from '../../src/TestingBotTunnel';

function checkEnvironment(environment: any) {
  assert.property(environment, 'selenium_name');
  assert.property(environment, 'name');
  assert.property(environment, 'platform');
  assert.property(environment, 'version');
}

let suite = {};
suite = addEnvironmentTest(suite, TestingBotTunnel, checkEnvironment);
suite = addStartStopTest(suite, TestingBotTunnel, { timeout: 60000 });

registerSuite('integration/TestingBotTunnel', suite);
