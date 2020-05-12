/// <reference path="../globals.d.ts" />

/**
 * Install some commonly used test functionals globally
 */
import { global } from '@theintern/common';
import chaiExclude from 'chai-exclude';

const chai = intern.getPlugin('chai');
chai.use(chaiExclude);
global.assert = chai.assert;

const { registerSuite } = intern.getPlugin('interface.object');
global.registerSuite = registerSuite;
