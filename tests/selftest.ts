import { execSync } from 'child_process';

if (process.env['INTERN_NODE_ONLY'] === '1') {
	console.log('Only running Node tests');
	execSync('npm run test', { stdio: 'inherit' });
}
else {
	console.log('Running Node and WebDriver tests');
	execSync('npm run test', { stdio: 'inherit' });
	execSync('npm run test webdriver', { stdio: 'inherit' });
}
