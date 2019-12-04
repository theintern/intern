import { assert as _assert } from 'chai';
import _registerSuite from 'src/core/lib/interfaces/object';

// Ensure intern global is available
import 'src/core';

declare global {
  export const registerSuite: typeof _registerSuite;
  export const assert: typeof _assert;
}
