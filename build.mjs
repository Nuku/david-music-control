// Usage: node build.mjs [--major|--minor]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(root, 'module.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const versionParts = manifest.version.split('.').map(Number);

if (process.argv.includes('--major')) {
	versionParts[0] += 1;
	versionParts[1] = 0;
	versionParts[2] = 0;
} else if (process.argv.includes('--minor')) {
	versionParts[1] += 1;
	versionParts[2] = 0;
} else {
	versionParts[2] += 1;
}

const newVersion = versionParts.join('.');
const tag = `v${newVersion}`;
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (!branch) throw new Error('Release requires a checked-out branch.');
try {
	execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { cwd: root, stdio: 'ignore' });
	throw new Error(`Tag ${tag} already exists.`);
} catch (error) {
	if (error.message.includes('already exists')) throw error;
}

const readline = createInterface({ input: process.stdin, output: process.stdout });
try {
	const answer = await readline.question(`Build and push ${manifest.title} v${manifest.version} -> v${newVersion}? (y/n) `);
	if (answer.trim().toLowerCase() !== 'y') {
		console.log('Aborted');
		process.exitCode = 0;
	} else {
		manifest.version = newVersion;
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\r\n`);

		const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
		execFileSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'package-release.ps1')], {
			cwd: root,
			stdio: 'inherit',
		});

		execFileSync('git', [
			'add',
			'module.json',
			'CHANGELOG.md',
			`${manifest.id}.zip`,
			'main.js',
			'main.css',
			'README.md',
			'module/',
			'styles/',
			'templates/',
			'build.mjs',
		], { cwd: root, stdio: 'inherit' });
		execFileSync('git', ['commit', '-m', `Release ${tag}`], { cwd: root, stdio: 'inherit' });
		execFileSync('git', ['tag', tag], { cwd: root, stdio: 'inherit' });
		execFileSync('git', ['push', 'origin', branch], { cwd: root, stdio: 'inherit' });
		execFileSync('git', ['push', 'origin', tag], { cwd: root, stdio: 'inherit' });
		console.log(`Released ${tag}.`);
	}
} finally {
	readline.close();
}
