/// <reference path="../globals.d.ts" />

/**
 * Install some commonly used test functionals globally
 */
import { global } from '@theintern/common';

const chai = intern.getPlugin('chai');
global.assert = chai.assert;

const { registerSuite } = intern.getPlugin('interface.object');
global.registerSuite = registerSuite;
