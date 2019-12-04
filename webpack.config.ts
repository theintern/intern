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
        test: /\.styl$/,
        use: ['style-loader', 'css-loader', 'stylus-loader']
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: 'tsconfig-browser.json'
          }
        }
      }
    ],
    noParse: /benchmark[\\\/]benchmark.js/
  },
  performance: {
    // Hides a warning about large bundles.
    hints: false
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  stats: {
    assets: false,
    entrypoints: true,
    errors: true,
    hash: false,
    modules: false,
    version: false,
    warnings: true
  }
};

module.exports = [
  {
    ...common,
    entry: getEntries(),
    output: {
      filename: '[name].js',
      path: join(__dirname, '_build/browser')
    }
  },
  {
    ...common,
    entry: getEntries(),
    output: {
      filename: '[name].js',
      path: join(__dirname, '_tests/browser')
    }
  }
];

function getEntries() {
  return {
    intern: './src/core/browser/intern.ts',
    remote: './src/core/browser/remote.ts',
    config: './src/core/browser/config.ts'
  };
}
