// TODO remove view if not using blessed
define([ 'dojo/has!host-node?dojo/node!blessed' ], function (blessed) {
	function TTYView() {

	}

	TTYView.prototype = {
		init: function () {
			this.program = blessed.program();
			this.screen = blessed.screen();
			this.header = blessed.box({
				top: 0,
				width: '100%',
				height: 5,
				content: 'Header'
			});

			this.body = blessed.box({
				bottom: 0,
				top: 5,
				width: '100%',
				height: '100%'
			});

			this.screen.append(this.header);
			this.screen.append(this.body);
			this.screen.render();
		},

		stop: function () {
			this.program.clear();
			this.program.disableMouse();
			this.program.showCursor();
			this.program.normalBuffer();
		}
	};
});