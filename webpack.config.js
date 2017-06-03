var path = require('path');

var common = {
	devServer: {
		stats: 'errors-only'
	},
	devtool: 'source-map',
	module: {
		loaders: [
			{ test: /_(?:build|tests)\//, loader: 'umd-compat-loader' },
			{ test: /@dojo\//, loader: 'umd-compat-loader' }
		],
		noParse: /benchmark\/benchmark.js/
	}
};

module.exports = [
	Object.assign({}, common, {
		entry: {
			intern: './_build/src/browser/intern.src.js',
			remote: './_build/src/browser/remote.src.js'
		},
		output: {
			filename: '[name].js',
			path: path.join(__dirname, '_build/src/browser')
		}
	}),
	Object.assign({}, common, {
		entry: {
			intern: './_tests/src/browser/intern.src.js',
			remote: './_tests/src/browser/remote.src.js'
		},
		output: {
			filename: '[name].js',
			path: path.join(__dirname, '_tests/src/browser')
		}
	})
];
