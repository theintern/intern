/**
 * This is the browser runner for end users. It simply loads and initializes a Browser executor.
 */
import Browser from '../lib/executors/Browser';
import Html from '../lib/reporters/Html';
import Console from '../lib/reporters/Console';
import global from '@dojo/core/global';

// A Benchmark global needs to be defined for benchmark.js to work properly when loaded as part of the Intern browser
// bundle since neither Node's require nor an AMD define will be present.
global.Benchmark = {};

const intern = global.intern = new Browser();

intern.registerReporter('html', Html);
intern.registerReporter('console', Console);
