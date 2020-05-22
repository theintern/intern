import { join } from 'path';
import { Configuration, HotModuleReplacementPlugin } from 'webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { sync as glob } from 'glob';
import { createConfigurator } from '../src/lib/node';
// eslint-disable-next-line
// @ts-ignore
import RewireMockPlugin from 'rewiremock/webpack/plugin';

const common: Configuration = {
  devtool: 'cheap-source-map',
  externals: {
    intern: 'intern',
  },
  // Needed for rewiremock
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.scss/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: join(__dirname, 'tsconfig.json'),
            onlyCompileBundledFiles: true,
            transpileOnly: true,
            experimentalWatchApi: true,
          },
        },
      },
      // chai-exclude needs to be ES5 for IE11 compatibility, so run it through
      // the TS compiler. The tsconfig-tests.json config enables JS compilation
      // with allowJs.
      {
        test: /\.js/,
        include: [require.resolve('chai-exclude')],
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: join(__dirname, 'tsconfig.json'),
            onlyCompileBundledFiles: true,
            transpileOnly: true,
          },
        },
      },
    ],
    // benchmark's code makes webpack sad; tell webpack not to look at it
    noParse: /benchmark\.js/,
  },
  performance: {
    // Hides a warning about large bundles.
    hints: false,
  },

  plugins: [
    // Needed for mocking
    new HotModuleReplacementPlugin(),
    // Needed for mocking
    new RewireMockPlugin(),
  ],

  resolve: {
    extensions: ['.ts', '.js'],

    // Needed to resolve 'tests/' and '/src' imports in test modules
    plugins: [
      new TsconfigPathsPlugin({
        configFile: join(__dirname, 'tsconfig.json'),
      }),
    ],
  },
  stats: 'errors-warnings',
};

module.exports = getEntries().then((entries) => [
  {
    ...common,
    entry: entries,
    output: {
      filename: '[name].js',
      path: join(__dirname, '..', '_tests'),
    },
  },
]);

async function getEntries() {
  const config = await createConfigurator().loadConfig();
  const rawSuites = config.suites!;
  rawSuites.push(
    ...glob('tests/unit/browser/**/*.ts', {
      // ignore any patterns already in suites
      ignore: rawSuites,
    })
  );

  const allSuites = rawSuites.reduce<string[]>(
    (suites, pattern) => [...suites, ...glob(pattern)],
    []
  );

  return {
    suites: Array.from(new Set(allSuites)),
    plugins: ['tests/support/globalUi.ts', 'tests/support/browserDom.ts'],
  };
}
