import moduleAlias from 'module-alias';
import { resolve } from 'path';

moduleAlias.addAlias('src', resolve(__dirname, '..', '..', '..', 'dist'));
