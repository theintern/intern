define([
	'./main',
	'./order',
	'./lib/EnvironmentType',
	'./lib/Suite',
	'./lib/Test',
	'./lib/util',
	'./lib/ReporterManager',
	'./lib/interfaces/tdd',
	'./lib/interfaces/bdd',
	'./lib/interfaces/object',
	'./lib/reporters/Console',
	'dojo/has!host-node?./lib/reporters/Pretty',
	'dojo/has!host-node?./lib/reporters/teamcity',
	'dojo/has!host-node?./lib/reporters/junit',
	'dojo/has!host-node?./lib/reporters/lcov'
], function () {});
