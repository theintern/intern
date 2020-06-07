import { join, resolve } from 'path';
import { Configuration } from 'webpack';
import { sync as glob } from 'glob';

const common: Configuration = {
  node: false,
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

const commonTest: Configuration = {
  entry: glob(join(__dirname, 'unit', '**', '*.ts')),
  mode: 'development',
  module: {
    rules: [
      {
        test: /@dojo/,
        use: 'umd-compat-loader'
      },
      {
        test: /.ts/,
        include: join(__dirname, '..', 'src'),
        use: {
          loader: 'istanbul-instrumenter-loader'
        }
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            instance: 'tests',
            transpileOnly: true,
            configFile: join(__dirname, 'tsconfig.json')
          }
        }
      }
    ]
  }
};

// Unit tests for the browser
const browserTestConfig: Configuration = {
  ...common,
  ...commonTest,
  output: {
    filename: join('_tests', 'unit.js'),
    path: resolve(__dirname, '..')
  }
};

module.exports = [browserTestConfig];
