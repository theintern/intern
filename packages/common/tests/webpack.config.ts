import { join, resolve } from 'path';
import { Configuration } from 'webpack';
import { sync as glob } from 'glob';

const config: Configuration = {
  entry: glob(join(__dirname, 'unit', '**', '*.ts')),

  mode: 'development',

  module: {
    rules: [
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
            // Browser build must support IE
            compilerOptions: {
              target: 'ES5'
            },
            configFile: join(__dirname, 'tsconfig.json'),
            onlyCompileBundledFiles: true,
            transpileOnly: true
          }
        }
      }
    ]
  },

  output: {
    filename: join('_tests', 'unit.js'),
    path: resolve(__dirname, '..')
  },

  performance: {
    // Hides a warning about large bundles.
    hints: false
  },

  resolve: {
    extensions: ['.ts', '.js']
  },

  stats: 'errors-warnings'
};

module.exports = config;
