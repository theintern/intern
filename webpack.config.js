var path = require('path');

var common = {
	devtool: 'source-map',
	module: {
		loaders: [
			{ test: /_(?:build|tests)\//, loader: 'umd-compat-loader' },
			{ test: /@dojo\//, loader: 'umd-compat-loader' }
		],
		noParse: /benchmark\/benchmark.js/
	},
	stats: {
		assets: true,
		errors: true,
		hash: false,
		modules: false,
		timings: false,
		version: false,
		warnings: true
	}
};

module.exports = [
	Object.assign({}, common, {
		entry: {
			intern: './_build/src/browser/intern.src.js',
			remote: './_build/src/browser/remote.src.js',
			config: './_build/src/browser/config.src.js'
		},
		output: {
			filename: '[name].js',
			path: path.join(__dirname, '_build/src/browser')
		}
	}),
	Object.assign({}, common, {
		entry: {
			intern: './_tests/src/browser/intern.src.js',
			remote: './_tests/src/browser/remote.src.js',
			config: './_tests/src/browser/config.src.js'
		},
		output: {
			filename: '[name].js',
			path: path.join(__dirname, '_tests/src/browser')
		}
	})
];
