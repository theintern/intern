import { join } from 'path';
import { Configuration, HotModuleReplacementPlugin } from 'webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { sync as glob } from 'glob';
import { getConfig } from './src/core/lib/node/util';
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
        test: /\.styl$/,
        use: ['style-loader', 'css-loader', 'stylus-loader']
      },
      {
        test: /\.ts/,
        use: {
          loader: 'ts-loader',
          options: {
            silent: true,
            configFile: 'tsconfig-tests.json',
            onlyCompileBundledFiles: true
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
  plugins: [new HotModuleReplacementPlugin(), new RewireMockPlugin()],
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin()]
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

module.exports = getEntries().then(entries => [
  {
    ...common,
    entry: entries.suites,
    output: {
      filename: 'suites.js',
      path: join(__dirname, '_tests')
    }
  },
  {
    ...common,
    entry: entries.plugins,
    output: {
      filename: 'plugins.js',
      path: join(__dirname, '_tests')
    }
  }
]);

async function getEntries() {
  const { config } = await getConfig();
  const configSuites: string[] = config.suites || [];
  if (config.browser && config.browser.suites) {
    configSuites.push(...config.browser.suites);
  }

  const suites = configSuites.reduce(
    (files, pattern) => [
      ...files,
      ...glob(pattern).map(file => join('.', file))
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
