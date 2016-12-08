import * as fs from 'fs';
const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', { encoding: 'utf8' }));
const buildDir = tsconfig.compilerOptions.outDir;
export default tsconfig;
export { buildDir };
