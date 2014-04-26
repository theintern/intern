define([
	'./main',
	'./order',
	'./lib/EnvironmentType',
	'./lib/Suite',
	'./lib/Test',
	'./lib/args',
	'./lib/util',
	'./lib/reporterManager',
	'./lib/interfaces/tdd',
	'./lib/interfaces/bdd',
	'./lib/interfaces/object',
	'./lib/interfaces/cucumber',
	'./lib/reporters/console',
	'dojo/has!host-node?./lib/reporters/teamcity',
	'dojo/has!host-node?./lib/reporters/lcov'
], function () {});
