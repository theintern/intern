import { default as Suite, KwArgs as SuiteKwArgs } from '../../../../../lib/Suite';

export interface KwArgs extends SuiteKwArgs {
	timeElapsed?: number;
}
export default class MockSuite extends Suite {
	constructor(kwArgs?: KwArgs) {
		super(kwArgs);
	}
}
