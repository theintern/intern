import { join } from 'path';
import { Configuration } from 'webpack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const mode =
  process.env['NODE_ENV'] === 'production' ||
  process.env['INTERN_BUILD'] === 'release'
    ? 'production'
    : 'development';

const config: Configuration = {
  entry: getEntries(),
  mode,
  module: {
    rules: [
      {
        test: /\.scss/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: 'tsconfig.json',
            onlyCompileBundledFiles: true,
            transpileOnly: true
          }
        }
      }
    ],
    // benchmark's code makes webpack sad; tell webpack not to look at it
    noParse: /benchmark\.js/
  },
  output: {
    filename: '[name].js',
    path: join(__dirname, 'dist', 'browser')
  },
  performance: {
    // Hides a warning about large bundles.
    hints: false
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  resolve: {
    extensions: ['.ts', '.js']
  },
  stats: 'errors-warnings'
};

module.exports = config;

function getEntries() {
  const baseDir = join(__dirname, 'src', 'browser');
  return {
    intern: join(baseDir, 'intern.ts'),
    remote: join(baseDir, 'remote.ts')
  };
}
