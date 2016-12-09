import { readFileSync } from 'fs';

const tsconfig = JSON.parse(readFileSync('tsconfig.json', { encoding: 'utf8' }));
const buildDir = tsconfig.compilerOptions.outDir;

export default tsconfig;
export { buildDir };
