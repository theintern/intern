define([
	'dojo/Promise'
], function (Promise) {
	return {
		_callStack: [],
		post: function() {
			var self = this;
			var args = Array.prototype.slice.apply(arguments);
			return new Promise(function (resolve) {
				resolve(self._callStack.push(args));
			});
		}
	};
});
