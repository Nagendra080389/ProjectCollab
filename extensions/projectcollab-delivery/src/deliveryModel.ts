/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const DELIVERY_STAGE_IDS = ['discover', 'plan', 'design', 'build', 'test', 'release'] as const;

export type DeliveryStageId = typeof DELIVERY_STAGE_IDS[number];
export type DeliveryStageStatus = 'pending' | 'running' | 'completed' | 'blocked';

export interface DeliveryTaskBinding {
	readonly name: string;
	readonly source: string;
}

export interface DeliveryStageState {
	readonly id: DeliveryStageId;
	readonly status: DeliveryStageStatus;
	readonly task?: DeliveryTaskBinding;
}

export interface DeliveryState {
	readonly version: 1;
	readonly activeStage: DeliveryStageId;
	readonly stages: readonly DeliveryStageState[];
	readonly updatedAt: number;
}

const stageIds = new Set<string>(DELIVERY_STAGE_IDS);
const stageStatuses = new Set<string>(['pending', 'running', 'completed', 'blocked']);

export function isDeliveryStageId(value: string): value is DeliveryStageId {
	return stageIds.has(value);
}

export function createInitialDeliveryState(now: number = Date.now()): DeliveryState {
	return {
		version: 1,
		activeStage: DELIVERY_STAGE_IDS[0],
		stages: DELIVERY_STAGE_IDS.map(id => ({ id, status: 'pending' })),
		updatedAt: now
	};
}

export function normalizeDeliveryState(value: unknown, now: number = Date.now()): DeliveryState {
	if (!value || typeof value !== 'object') {
		return createInitialDeliveryState(now);
	}

	const candidate = value as Partial<DeliveryState>;
	const inputStages = Array.isArray(candidate.stages) ? candidate.stages : [];
	const normalizedStages = DELIVERY_STAGE_IDS.map(id => {
		const input = inputStages.find(stage => stage?.id === id);
		const status = input && stageStatuses.has(input.status) ? input.status : 'pending';
		const task = normalizeTaskBinding(input?.task);
		return task ? { id, status, task } : { id, status };
	});
	const activeStage = typeof candidate.activeStage === 'string' && isDeliveryStageId(candidate.activeStage)
		? candidate.activeStage
		: normalizedStages.find(stage => stage.status !== 'completed')?.id ?? DELIVERY_STAGE_IDS[0];

	return {
		version: 1,
		activeStage,
		stages: normalizedStages,
		updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : now
	};
}

function normalizeTaskBinding(value: DeliveryTaskBinding | undefined): DeliveryTaskBinding | undefined {
	if (!value || typeof value.name !== 'string' || value.name.trim().length === 0 || typeof value.source !== 'string') {
		return undefined;
	}
	return { name: value.name, source: value.source };
}

export function getStageState(state: DeliveryState, stageId: DeliveryStageId): DeliveryStageState {
	return state.stages.find(stage => stage.id === stageId) ?? { id: stageId, status: 'pending' };
}

export function selectStage(state: DeliveryState, stageId: DeliveryStageId, now: number = Date.now()): DeliveryState {
	return { ...state, activeStage: stageId, updatedAt: now };
}

export function setStageStatus(
	state: DeliveryState,
	stageId: DeliveryStageId,
	status: DeliveryStageStatus,
	now: number = Date.now()
): DeliveryState {
	return {
		...state,
		activeStage: stageId,
		stages: state.stages.map(stage => stage.id === stageId ? { ...stage, status } : stage),
		updatedAt: now
	};
}

export function completeStage(state: DeliveryState, stageId: DeliveryStageId, now: number = Date.now()): DeliveryState {
	const stages = state.stages.map(stage => stage.id === stageId ? { ...stage, status: 'completed' as const } : stage);
	const completedIndex = DELIVERY_STAGE_IDS.indexOf(stageId);
	const next = stages.slice(completedIndex + 1).find(stage => stage.status !== 'completed');
	return {
		...state,
		activeStage: next?.id ?? stageId,
		stages,
		updatedAt: now
	};
}

export function bindStageTask(
	state: DeliveryState,
	stageId: DeliveryStageId,
	task: DeliveryTaskBinding,
	now: number = Date.now()
): DeliveryState {
	return {
		...state,
		stages: state.stages.map(stage => stage.id === stageId ? { ...stage, task } : stage),
		updatedAt: now
	};
}
