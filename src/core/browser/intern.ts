/**
 * This is the browser runner for end users. It simply loads and initializes a
 * Browser executor.
 */
import '../lib/browser/shim';
import { global } from '../../common';
import Browser from '../lib/executors/Browser';

// A Benchmark global needs to be defined for benchmark.js to work properly when
// loaded as part of the Intern browser bundle since neither Node's require nor
// an AMD define will be present.
global.Benchmark = {};

global.intern = new Browser();
