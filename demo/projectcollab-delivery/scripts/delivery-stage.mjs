import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const stage = process.argv[2];
const root = process.cwd();
const artifacts = join(root, 'delivery-artifacts');
const timestamp = () => new Date().toISOString();
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function artifact(name, body) {
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, name), `${body.trim()}\n`, 'utf8');
}

async function discover() {
	console.log('[Discover] Inspecting product context and stakeholder outcome...');
	await pause(350);
	await artifact('01-discovery-brief.md', `# Discovery brief

## Problem

Delivery teams lose time reconstructing status across code, chat, task trackers, and release checklists.

## User outcome

A delivery lead can see progress, risk, execution evidence, and release readiness in one IDE workspace.

## Success measures

- All six delivery stages have an executable verification task.
- Every completed stage creates durable evidence.
- A failed task visibly blocks progression.
- Release execution requires explicit human confirmation.

Generated: ${timestamp()}`);
}

async function plan() {
	console.log('[Plan] Converting the outcome into accepted milestones...');
	await pause(350);
	await artifact('02-delivery-plan.md', `# Delivery plan

| Milestone | Acceptance criterion | Owner |
| --- | --- | --- |
| Shared dashboard | Progress, work, ownership, and risk load from the delivery API | Product engineering |
| Verified build | Static product bundle is created without external dependencies | Build owner |
| Quality gate | Unit coverage validates progress and risk calculations | Quality owner |
| Release package | Versioned bundle and manifest are generated after approval | Release owner |

Primary risk: a UI can imply confidence without evidence. Mitigation: show generated artifacts and task history beside stage status.

Generated: ${timestamp()}`);
}

async function design() {
	console.log('[Design] Capturing architecture and operational decisions...');
	await pause(350);
	await artifact('03-architecture.md', `# Architecture decision

## Shape

Browser -> Node HTTP service -> delivery domain module

## Decisions

- Use a dependency-free Node service so the demo is deterministic and starts offline.
- Keep progress calculation in a pure domain module so it is independently testable.
- Package static assets and server source together for a reviewable release.
- Generate human-readable Markdown evidence at each pipeline gate.

## Operational boundary

The service binds to localhost for the demo. Production authentication, persistence, and deployment adapters remain explicit follow-up work.

Generated: ${timestamp()}`);
}

async function build() {
	console.log('[Build] Creating a clean, runnable application bundle...');
	const output = join(root, 'dist');
	await rm(output, { recursive: true, force: true });
	await mkdir(output, { recursive: true });
	await cp(join(root, 'public'), join(output, 'public'), { recursive: true });
	await cp(join(root, 'src'), join(output, 'src'), { recursive: true });
	await writeFile(join(output, 'package.json'), JSON.stringify({ name: 'projectpulse-release', version: '1.0.0', private: true, type: 'module', scripts: { start: 'node src/server.mjs' } }, null, 2));
	await pause(350);
	await artifact('04-build-report.md', `# Build report

- Result: passed
- Runtime: Node.js
- External runtime dependencies: none
- Output: \`dist/\`
- Entry point: \`node src/server.mjs\`

Generated: ${timestamp()}`);
}

async function test() {
	console.log('[Test] Running delivery domain quality gates...');
	const result = spawnSync(process.execPath, ['--test', 'test/delivery.test.mjs'], { cwd: root, encoding: 'utf8' });
	process.stdout.write(result.stdout || '');
	process.stderr.write(result.stderr || '');
	await artifact('05-test-report.md', `# Test report

- Result: ${result.status === 0 ? 'passed' : 'failed'}
- Suite: delivery domain
- Assertions: weighted progress, empty state, active work, and risk summary
- Exit code: ${result.status ?? 'unknown'}

Generated: ${timestamp()}`);
	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
	}
}

async function release() {
	console.log('[Release] Packaging the approved candidate and manifest...');
	try {
		await readFile(join(root, 'dist', 'package.json'));
	} catch {
		console.log('[Release] No build was found; creating one first.');
		await build();
	}
	const releaseRoot = join(root, 'release', 'ProjectPulse-1.0.0');
	await rm(releaseRoot, { recursive: true, force: true });
	await mkdir(releaseRoot, { recursive: true });
	await cp(join(root, 'dist'), releaseRoot, { recursive: true });
	const manifest = { product: 'ProjectPulse', version: '1.0.0', status: 'approved-candidate', createdAt: timestamp(), evidence: ['01-discovery-brief.md', '02-delivery-plan.md', '03-architecture.md', '04-build-report.md', '05-test-report.md'] };
	await writeFile(join(releaseRoot, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
	await pause(350);
	await artifact('06-release-notes.md', `# Release notes - ProjectPulse 1.0.0

## Delivered

- Shared delivery confidence, work ownership, stage, and risk dashboard.
- Verifiable build and test gates.
- Reviewable evidence trail across the complete delivery lifecycle.
- Approval-protected release packaging.

Release candidate: \`release/ProjectPulse-1.0.0/\`

Generated: ${timestamp()}`);
}

const stages = { discover, plan, design, build, test, release };
if (!stages[stage]) {
	console.error(`Unknown delivery stage: ${stage || '(missing)'}`);
	process.exit(2);
}

console.log(`ProjectCollab delivery task started: ${stage}`);
await stages[stage]();
if (!process.exitCode) {
	console.log(`ProjectCollab delivery task completed: ${stage}`);
}
