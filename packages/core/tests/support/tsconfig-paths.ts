/**
 * Setup tsconfig-paths for testing
 *
 * This allows the imports like 'test/' and 'src/' to work when the tests are
 * run with ts-node.
 */
import {
  loadConfig,
  register,
  ConfigLoaderSuccessResult
} from 'tsconfig-paths';
import { resolve } from 'path';

const tsconfig = resolve(__dirname, '..', 'tsconfig.json');
const result = loadConfig(tsconfig) as ConfigLoaderSuccessResult;

register({
  paths: result.paths,
  baseUrl: result.absoluteBaseUrl
});
