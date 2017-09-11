import { join } from 'path';
import { optimize, Configuration } from 'webpack';

const common: Configuration = {
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /_(?:build|tests)\//,
				use: 'umd-compat-loader'
			},
			{
				test: /@dojo\//,
				use: 'umd-compat-loader'
			},
			{
				test: /\.styl$/,
				use: ['style-loader', 'css-loader', 'stylus-loader']
			}
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

if (
	process.env['NODE_ENV'] === 'production' ||
	process.env['INTERN_BUILD'] === 'release'
) {
	common.plugins = [new optimize.UglifyJsPlugin()];
}

module.exports = [
	{
		...common,
		entry: {
			intern: './_build/src/browser/intern.src.js',
			remote: './_build/src/browser/remote.src.js',
			config: './_build/src/browser/config.src.js'
		},
		output: {
			filename: '[name].js',
			path: join(__dirname, '_build/src/browser')
		}
	},
	{
		...common,
		entry: {
			intern: './_tests/src/browser/intern.src.js',
			remote: './_tests/src/browser/remote.src.js',
			config: './_tests/src/browser/config.src.js'
		},
		output: {
			filename: '[name].js',
			path: join(__dirname, '_tests/src/browser')
		}
	}
];
