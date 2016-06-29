define([
	'intern/dojo/node!dojo/request'
], function (request) {
	/**
	 * Checks to see if Selenium is already running
	 * 
	 * @param port the port selenium is running on
	 * @param hostname the hostname selenium is running on
	 */
	return function (port, hostname) {
		port = port || 4444;
		hostname = hostname || 'localhost';
		return request('http://' + hostname + ':' + port + '/wd/hub/status', {
			handleAs: 'text'
		}).then(function (response) {
			if (response.statusCode !== 200) {
				throw new Error('Server reported ' + response.statusCode + ' with: ' + response.data);
			}

			var json = JSON.parse(response.data.toString());

			if ( json.state !== 'success' ) {
				throw new Error('Selenium Tunnel reported a state of ' + json.state );
			}
		});
	};
});
