import { sync as glob, hasMagic } from 'glob';
import { join, resolve } from 'path';
import {
  Configuration,
  HotModuleReplacementPlugin,
  NamedModulesPlugin
} from 'webpack';

const common: Configuration = {
  mode: 'development',
  module: {
    rules: [
      {
        test: /@theintern\/common/,
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
            silent: true,
            onlyCompileBundledFiles: true
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
      path: join(__dirname, '../_tests/src/browser')
    }
  },
  {
    ...common,
    devtool: 'eval',
    entry: {
      unitTests: getUnitTests()
    },
    output: {
      filename: '[name].js',
      path: join(__dirname, '../_tests/tests')
    },
    plugins: [
      new NamedModulesPlugin(),
      new HotModuleReplacementPlugin(),
      new (require('rewiremock/webpack/plugin'))()
    ],
    resolve: {
      alias: {
        src: resolve(__dirname, '..', 'src')
      },
      extensions: ['.ts', '.js']
    }
  }
];

function getEntries() {
  return {
    intern: join(__dirname, '../src/browser/intern.ts'),
    remote: join(__dirname, '../src/browser/remote.ts'),
    config: join(__dirname, '../src/browser/config.ts')
  };
}

function getUnitTests() {
  return [
    // 'benchmark/example',
    // 'unit/lib/BenchmarkTest',
    'unit/lib/Channel'
    // 'unit/lib/Deferred',
    // 'unit/lib/Environment',
    // 'unit/lib/Suite',
    // 'unit/lib/Test',
    // 'unit/lib/channels/**/*',
    // 'unit/lib/common/**/*',
    // 'unit/lib/executors/Browser',
    // 'unit/lib/executors/Executor',
    // 'unit/lib/interfaces/**/*',
    // 'unit/lib/reporters/Console',
    // 'unit/lib/reporters/Dom',
    // 'unit/lib/reporters/Html',
    // 'unit/loaders/**/*'
  ].reduce(
    (allTests, test) => {
      const fullPath = join(__dirname, '..', 'tests', `${test}.ts`);
      const expanded = hasMagic(test) ? glob(fullPath) : [fullPath];
      return [...allTests, ...expanded];
    },
    <string[]>[]
  );
}
