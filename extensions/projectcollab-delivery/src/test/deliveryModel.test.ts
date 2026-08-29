/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	bindStageTask,
	completeStage,
	createInitialDeliveryState,
	getStageState,
	normalizeDeliveryState,
	selectStage,
	setStageStatus
} from '../deliveryModel';

suite('ProjectCollab Delivery Model', () => {
	test('creates an ordered pipeline with Discover active', () => {
		const state = createInitialDeliveryState(10);
		assert.deepStrictEqual({
			activeStage: state.activeStage,
			stageIds: state.stages.map(stage => stage.id),
			statuses: state.stages.map(stage => stage.status),
			updatedAt: state.updatedAt
		}, {
			activeStage: 'discover',
			stageIds: ['discover', 'plan', 'design', 'build', 'test', 'release'],
			statuses: ['pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
			updatedAt: 10
		});
	});

	test('completes a stage and advances to the next incomplete stage', () => {
		const initial = createInitialDeliveryState(10);
		const planAlreadyComplete = setStageStatus(initial, 'plan', 'completed', 20);
		const result = completeStage(planAlreadyComplete, 'discover', 30);
		assert.deepStrictEqual({
			activeStage: result.activeStage,
			discover: getStageState(result, 'discover').status,
			plan: getStageState(result, 'plan').status,
			updatedAt: result.updatedAt
		}, {
			activeStage: 'design',
			discover: 'completed',
			plan: 'completed',
			updatedAt: 30
		});
	});

	test('keeps the release stage active after completing the pipeline', () => {
		const result = completeStage(selectStage(createInitialDeliveryState(), 'release'), 'release');
		assert.deepStrictEqual({
			activeStage: result.activeStage,
			status: getStageState(result, 'release').status
		}, {
			activeStage: 'release',
			status: 'completed'
		});
	});

	test('stores task identity with the stage', () => {
		const result = bindStageTask(createInitialDeliveryState(), 'build', { name: 'compile', source: 'Workspace' }, 20);
		assert.deepStrictEqual(getStageState(result, 'build').task, { name: 'compile', source: 'Workspace' });
	});

	test('normalizes incomplete persisted state without losing valid progress', () => {
		const result = normalizeDeliveryState({
			activeStage: 'build',
			stages: [
				{ id: 'discover', status: 'completed' },
				{ id: 'build', status: 'not-a-status', task: { name: 'compile', source: 'Workspace' } }
			],
			updatedAt: 50
		}, 100);
		assert.deepStrictEqual({
			activeStage: result.activeStage,
			discover: getStageState(result, 'discover').status,
			build: getStageState(result, 'build'),
			stageCount: result.stages.length,
			updatedAt: result.updatedAt
		}, {
			activeStage: 'build',
			discover: 'completed',
			build: { id: 'build', status: 'pending', task: { name: 'compile', source: 'Workspace' } },
			stageCount: 6,
			updatedAt: 50
		});
	});

	test('marks a blocked stage as the active stage', () => {
		const result = setStageStatus(createInitialDeliveryState(), 'test', 'blocked', 20);
		assert.deepStrictEqual({
			activeStage: result.activeStage,
			status: getStageState(result, 'test').status
		}, {
			activeStage: 'test',
			status: 'blocked'
		});
	});
});
