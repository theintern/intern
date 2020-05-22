// eslint-disable
import { join, relative } from 'path';
import { Configuration, SourceMapDevToolPlugin } from 'webpack';

const mode =
  process.env['NODE_ENV'] === 'production' ||
  process.env['INTERN_BUILD'] === 'release'
    ? 'production'
    : 'development';

const contextPath = __dirname;

const common: Configuration = {
  devtool: false,
  mode,
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
            onlyCompileBundledFiles: true,
            transpileOnly: true,
            configFile: 'src/browser/tsconfig.json',
          },
        },
      },
    ],
    // benchmark's code makes webpack sad; tell webpack not to look at it
    noParse: /benchmark\.js/,
  },
  output: {
    devtoolModuleFilenameTemplate(info) {
      console.log(info.absoluteResourcePath);
      return `webpack:///${relative(contextPath, info.absoluteResourcePath)}`;
    },
  },
  performance: {
    // Hides a warning about large bundles.
    hints: false,
  },
  plugins: [
    new SourceMapDevToolPlugin({
      filename: '[name].js.map',
      exclude: /node_modules/,
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  stats: 'errors-warnings',
};

module.exports = [
  {
    ...common,
    entry: getEntries(),
    output: {
      filename: '[name].js',
      path: join(__dirname, 'dist', 'browser'),
    },
  },
];

function getEntries() {
  const baseDir = join(__dirname, 'src', 'browser');
  return {
    intern: join(baseDir, 'intern.ts'),
    remote: join(baseDir, 'remote.ts'),
  };
}
