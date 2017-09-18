import { join } from 'path';
import { optimize, Configuration } from 'webpack';

const common: Configuration = {
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /@dojo\//,
				use: 'umd-compat-loader'
			},
			{
				test: /\.styl$/,
				use: ['style-loader', 'css-loader', 'stylus-loader']
			},
			{
				test: /\.ts/,
				use: 'ts-loader'
			}
		],
		noParse: /benchmark\/benchmark.js/
	},
	stats: {
		assets: false,
		errors: true,
		hash: false,
		modules: true,
		version: false,
		warnings: true
	},
	resolve: {
		extensions: ['.ts', '.js']
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
			intern: './src/browser/intern.ts',
			remote: './src/browser/remote.ts',
			config: './src/browser/config.ts'
		},
		output: {
			filename: '[name].js',
			path: join(__dirname, '_build/src/browser')
		}
	},
	{
		...common,
		entry: {
			intern: './src/browser/intern.ts',
			remote: './src/browser/remote.ts',
			config: './src/browser/config.ts'
		},
		output: {
			filename: '[name].js',
			path: join(__dirname, '_tests/src/browser')
		}
	}
];
