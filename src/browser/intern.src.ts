/**
 * This is the browser runner for end users. It simply loads and initializes a Browser executor.
 */
import Browser from '../lib/executors/Browser';
import global from '@dojo/shim/global';

// A Benchmark global needs to be defined for benchmark.js to work properly when loaded as part of the Intern browser
// bundle since neither Node's require nor an AMD define will be present.
global.Benchmark = {};

global.intern = new Browser();
