import { global } from '../../common';
import { getConfig } from '../lib/browser/util';
import { getConfigDescription } from '../lib/common/util';

global.internConfig = {
  getConfig,
  getConfigDescription
};
