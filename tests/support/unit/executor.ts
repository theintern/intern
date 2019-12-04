import { SinonSpy } from 'sinon';
import { Executor, Config } from 'src/core/lib/executors/Executor';

const { assert } = intern.getPlugin('chai');

export function testProperty<C extends Config = Config>(
  executor: Executor,
  mockConsole: { [name: string]: SinonSpy },
  name: keyof C,
  badValue: any,
  goodValue: any,
  expectedValue: any,
  error: RegExp,
  allowDeprecated?: boolean | string,
  message?: string
) {
  if (typeof allowDeprecated === 'string') {
    message = allowDeprecated;
    allowDeprecated = undefined;
  }
  if (typeof allowDeprecated === 'undefined') {
    allowDeprecated = false;
  }

  assert.throws(() => {
    executor.configure(<any>{ [name]: badValue });
  }, error);
  executor.configure(<any>{ [name]: goodValue });

  if (allowDeprecated) {
    for (let call of mockConsole.warn.getCalls()) {
      assert.include(
        call.args[0],
        'deprecated',
        'no warning should have been emitted'
      );
    }
  } else {
    assert.equal(
      mockConsole.warn.callCount,
      0,
      'no warning should have been emitted'
    );
  }

  name = <keyof Config>(<string>name).replace(/\+$/, '');
  const config = <C>executor.config;
  if (typeof expectedValue === 'object') {
    assert.deepEqual(config[name], expectedValue, message);
  } else {
    assert.strictEqual(config[name], expectedValue, message);
  }
}
