import './main';
import './order';
import './lib/EnvironmentType';
import './lib/Suite';
import './lib/Test';
import './lib/util';
import './lib/ReporterManager';
import './lib/interfaces/tdd';
import './lib/interfaces/bdd';
import './lib/interfaces/object';
import './lib/interfaces/qunit';
import './lib/reporters/Console';
import has = require('intern/dojo/has');

if (has('host-node')) {
	require('./lib/reporters/Pretty');
	require('./lib/reporters/TeamCity');
	require('./lib/reporters/JUnit');
	require('./lib/reporters/Lcov');
}
