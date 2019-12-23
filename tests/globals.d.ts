import { assert as _assert } from 'chai';
import _registerSuite from '../src/lib/interfaces/object';

declare global {
  export const registerSuite: typeof _registerSuite;
  export const assert: typeof _assert;
}
