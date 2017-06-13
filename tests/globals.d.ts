import _registerSuite from '../src/lib/interfaces/object';
import { assert as _assert } from 'chai';

declare global {
	export const registerSuite: typeof _registerSuite;
	export const assert: typeof _assert;
}
