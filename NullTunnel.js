define([
	'dojo/Deferred',
	'./util',
	'./Tunnel'
], function (Deferred, util, Tunnel) {
	function success() {
		var dfd = new Deferred();
		dfd.resolve();
		return dfd.promise;
	}

	function NullTunnel() {
		Tunnel.apply(this, arguments);
	}

	var _super = Tunnel.prototype;
	NullTunnel.prototype = util.mixin(Object.create(_super), /** @lends module:digdug/NullTunnel */ {
		isDownloaded: true,
		download: success,
		start: function () {
			this.isRunning = true;
			return success();
		},
		stop: function () {
			this.isRunning = false;
			return success();
		}
	});

	return NullTunnel;
});
