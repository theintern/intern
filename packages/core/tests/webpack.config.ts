import { resolve } from 'path';
import {
  Configuration,
  HotModuleReplacementPlugin,
  NormalModuleReplacementPlugin
} from 'webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { sync as glob } from 'glob';
import { createConfigurator } from '../src/lib/node';
// @ts-ignore
import RewireMockPlugin from 'rewiremock/webpack/plugin';

const common: Configuration = {
  externals: {
    intern: 'intern'
  },
  // Needed for rewiremock
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.scss/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /.ts/,
        include: resolve(__dirname, '..', 'src'),
        exclude: /.scss/,
        use: {
          loader: 'istanbul-instrumenter-loader'
        }
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            // Browser build must support IE
            compilerOptions: {
              target: 'ES5'
            },
            configFile: resolve(__dirname, 'tsconfig.json'),
            onlyCompileBundledFiles: true,
            transpileOnly: true
          }
        }
      },
      // chai-exclude needs to be ES5 for IE11 compatibility, so run it through
      // the TS compiler. The tsconfig-tests.json config enables JS compilation
      // with allowJs.
      {
        test: /\.js/,
        include: [resolve(__dirname, 'node_modules', 'chai-exclude')],
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: 'tsconfig-tests.json',
            onlyCompileBundledFiles: true,
            transpileOnly: true
          }
        }
      }
    ],
    // benchmark's code makes webpack sad; tell webpack not to look at it
    noParse: /benchmark\.js/
  },
  performance: {
    // Hides a warning about large bundles.
    hints: false
  },

  plugins: [
    // Needed for mocking
    new HotModuleReplacementPlugin(),
    // Needed for mocking
    new RewireMockPlugin(),
    // Needed for webpack mocking
    new NormalModuleReplacementPlugin(
      /.\/rewiremock\.js/,
      './rewiremock-webpack.js'
    )
  ],

  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: resolve(__dirname, 'tsconfig.json')
      })
    ]
  },
  stats: 'errors-warnings'
};

module.exports = getEntries().then(entries =>
  Object.keys(entries).map(name => ({
    ...common,
    entry: entries[name as keyof typeof entries],
    output: {
      filename: `${name}.js`,
      path: resolve(__dirname, '..', '_tests')
    }
  }))
);

async function getEntries() {
  const config = await createConfigurator().loadConfig();
  const configSuites: string[] = config.suites || [];
  if (config.browser && config.browser.suites) {
    configSuites.push(...config.browser.suites);
  }

  const suites = configSuites.reduce(
    (files, pattern) => [
      ...files,
      ...glob(pattern).map(file => resolve('.', file))
    ],
    [] as string[]
  );

  const configPlugins: { script: string }[] = config.plugins || [];
  if (config.browser && config.browser.plugins) {
    configPlugins.push(...config.browser.plugins);
  }

  const plugins = configPlugins.map(plugin => plugin.script);

  return { suites, plugins };
}
