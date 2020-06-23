import { assert as _assert } from 'chai';
import _registerSuite from 'src/lib/interfaces/object';

// Ensure intern global is available
import 'src';

declare global {
  export const registerSuite: typeof _registerSuite;
  export const assert: typeof _assert;
}
