import { getConfig } from '../lib/browser/util';
import { getConfigDescription } from '../lib/common/util';
import global from '@dojo/shim/global';

global.internConfig = {
	getConfig,
	getConfigDescription
};
