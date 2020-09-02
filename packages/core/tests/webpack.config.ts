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
      // Process both TS and JS through ts-loader to ensure JS is transpiled to
      // ES5 for IE compatibility
      {
        test: /\.[tj]s/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              allowJs: true,
              target: 'ES5'
            },
            configFile: resolve(__dirname, 'tsconfig.json'),
            onlyCompileBundledFiles: true,
            silent: true,
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
      // Windows will use backslashes in its resource paths, so the matcher
      // should account for that.
      /(?<=test-util[\\/]dist[\\/]lib[\\/])rewiremock\.js/,
      'rewiremock-webpack.js'
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
