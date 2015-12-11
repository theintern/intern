import { default as Test, KwArgs as TestKwArgs } from '../../../../../lib/Test';

export interface KwArgs extends TestKwArgs {
	error?: Error;
	hasPassed?: boolean;
	skipped?: string;
	timeElapsed?: number;
}
export default class MockTest extends Test {
	constructor(kwArgs?: KwArgs) {
		super(kwArgs);
	}
}
