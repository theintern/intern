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
	error: RegExp, message?: string
) {
	assert.throws(() => { executor.configure(<any>{ [name]: badValue }); }, error);
	executor.configure(<any>{ [name]: goodValue });
	assert.equal(mockConsole.warn.callCount, 0, 'no warning should have been emitted');
	name = <keyof Config>name.replace(/\+$/, '');
	const config = <C>executor.config;
	if (typeof expectedValue === 'object') {
		assert.deepEqual(config[name], expectedValue, message);
	}
	else {
		assert.strictEqual(config[name], expectedValue, message);
	}
}
