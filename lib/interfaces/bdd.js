define([
	'dojo/_base/lang',
	'./tdd'
], function (lang, tdd) {
	return lang.delegate(tdd, {
		describe: tdd.suite,
		it: tdd.test,
		suite: undefined,
		test: undefined
	});
});
