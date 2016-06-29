define([
	'intern/dojo/node!https',
	'intern/dojo/node!url',
	'intern/dojo/Promise'
], function (https, urlUtil, Promise) {
	/**
	 * Uses a HEAD request to check for the existence of the URL endpoint
	 *
	 * @param {string} url the target URL
	 */
	return function (url) {
		return new Promise(function (resolve, reject) {
			var options = urlUtil.parse(url);
			options.method = 'HEAD';
			// using https module due to an issue w/ 302'd https head requests w/ dojo/request
			// https://github.com/ansible/ansible-modules-core/issues/3457
			https.request(options, function (response) {
				if (response.statusCode >= 400) {
					reject(new Error('Status code ' + response.statusCode + ' returned for ' + url));
				}
				else {
					resolve(response);
				}
			}).end();
		});
	};
});
