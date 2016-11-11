/* global Promise */

var util = require('util');
var exec = require('child_process').exec;

var rl = exports.rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

exports.print = function() {
	rl.write(util.format.apply(util, arguments));
};

exports.prompt = function () {
	var question = util.format.apply(util, arguments);
	return new Promise(function (resolve) {
		rl.question(question, function (answer) {
			resolve(answer);
		});
	});
};

exports.shouldRun = true;

exports.run = function (cmd) {
	return new Promise(function (resolve, reject) {
		if (exports.shouldRun) {
			exec(cmd, function (error, stdout) {
				if (error) {
					reject(error);
				}
				else {
					resolve(stdout);
				}
			});
		}
		else {
			exports.print(cmd + '\n');
			resolve('');
		}
	});
};
