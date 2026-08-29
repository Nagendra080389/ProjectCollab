import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProgress, summarizeDelivery } from '../src/delivery.mjs';

test('calculates weighted delivery progress', () => {
	assert.equal(calculateProgress([{ status: 'Build' }, { status: 'Done' }]), 80);
});

test('returns zero progress for an empty delivery', () => {
	assert.equal(calculateProgress([]), 0);
});

test('summarizes active and at-risk work', () => {
	const summary = summarizeDelivery([
		{ status: 'Test', risk: 'Medium' },
		{ status: 'Done', risk: 'Low' }
	]);
	assert.equal(summary.active, 1);
	assert.equal(summary.atRisk, 1);
	assert.equal(summary.progress, 90);
});
