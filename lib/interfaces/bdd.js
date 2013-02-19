define([
	'./tdd'
], function (tdd) {
	function TMP() {}
	TMP.prototype = tdd;

	var bdd = new TMP();

	bdd.describe = tdd.suite;
	bdd.it = tdd.test;
	bdd.suite = undefined;
	bdd.test = undefined;

	return bdd;
});