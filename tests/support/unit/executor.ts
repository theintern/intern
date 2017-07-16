const { assert } = intern.getPlugin('chai');
import Executor, { Config } from 'src/lib/executors/Executor';
import { SinonSpy } from 'sinon';

export function testProperty<E extends Executor = Executor, C extends Config = Config>(
	executor: E,
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

	assert.throws(() => { executor.configure(<any>{ [name]: badValue }); }, error);
	executor.configure(<any>{ [name]: goodValue });

	if (allowDeprecated) {
		for (let call of mockConsole.warn.getCalls()) {
			assert.include(call.args[0], 'deprecated', 'no warning should have been emitted');
		}
	}
	else {
		assert.equal(mockConsole.warn.callCount, 0, 'no warning should have been emitted');
	}

	name = <keyof Config>name.replace(/\+$/, '');
	const config = <C>executor.config;
	if (typeof expectedValue === 'object') {
		assert.deepEqual(config[name], expectedValue, message);
	}
	else {
		assert.strictEqual(config[name], expectedValue, message);
	}
}
