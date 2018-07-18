/**
 * Export global types for the loaders to use
 */
import _Browser from '../lib/executors/Browser';
declare global {
  type Browser = _Browser;
}
