import { join } from 'path';
import { Configuration } from 'webpack';

const mode =
	process.env['NODE_ENV'] === 'production' ||
	process.env['INTERN_BUILD'] === 'release'
		? 'production'
		: 'development';

const common: Configuration = {
	mode,
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
				use: {
					loader: 'ts-loader',
					options: {
						silent: true
					}
				}
			}
		],
		noParse: /benchmark\/benchmark.js/
	},
	performance: {
		// Hides a warning about large bundles.
		hints: false
	},
	stats: {
		assets: false,
		entrypoints: true,
		errors: true,
		hash: false,
		modules: false,
		version: false,
		warnings: true
	},
	resolve: {
		extensions: ['.ts', '.js']
	}
};

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
