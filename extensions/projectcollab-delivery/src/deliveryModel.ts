/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const DELIVERY_STAGE_IDS = ['discover', 'plan', 'design', 'build', 'test', 'release'] as const;

export type DeliveryStageId = typeof DELIVERY_STAGE_IDS[number];
export type DeliveryStageStatus = 'pending' | 'running' | 'completed' | 'blocked';
export type DeliveryRunStatus = 'running' | 'succeeded' | 'failed';

export interface DeliveryTaskBinding {
	readonly name: string;
	readonly source: string;
}

export interface DeliveryStageState {
	readonly id: DeliveryStageId;
	readonly status: DeliveryStageStatus;
	readonly task?: DeliveryTaskBinding;
}

export interface DeliveryRunRecord {
	readonly id: string;
	readonly stageId: DeliveryStageId;
	readonly task: DeliveryTaskBinding;
	readonly status: DeliveryRunStatus;
	readonly startedAt: number;
	readonly endedAt?: number;
	readonly exitCode?: number;
}

export interface DeliveryState {
	readonly version: 2;
	readonly activeStage: DeliveryStageId;
	readonly stages: readonly DeliveryStageState[];
	readonly runs: readonly DeliveryRunRecord[];
	readonly updatedAt: number;
}

const stageIds = new Set<string>(DELIVERY_STAGE_IDS);
const stageStatuses = new Set<string>(['pending', 'running', 'completed', 'blocked']);

export function isDeliveryStageId(value: string): value is DeliveryStageId {
	return stageIds.has(value);
}

export function createInitialDeliveryState(now: number = Date.now()): DeliveryState {
	return {
		version: 2,
		activeStage: DELIVERY_STAGE_IDS[0],
		stages: DELIVERY_STAGE_IDS.map(id => ({ id, status: 'pending' })),
		runs: [],
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
	const runs = Array.isArray(candidate.runs)
		? candidate.runs.map(normalizeRunRecord).filter((run): run is DeliveryRunRecord => run !== undefined).slice(0, 20)
		: [];

	return {
		version: 2,
		activeStage,
		stages: normalizedStages,
		runs,
		updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : now
	};
}

function normalizeRunRecord(value: unknown): DeliveryRunRecord | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const candidate = value as Partial<DeliveryRunRecord>;
	const task = normalizeTaskBinding(candidate.task);
	if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.stageId !== 'string' || !isDeliveryStageId(candidate.stageId) || !task) {
		return undefined;
	}
	if (candidate.status !== 'running' && candidate.status !== 'succeeded' && candidate.status !== 'failed') {
		return undefined;
	}
	if (typeof candidate.startedAt !== 'number' || !Number.isFinite(candidate.startedAt)) {
		return undefined;
	}
	return {
		id: candidate.id,
		stageId: candidate.stageId,
		task,
		status: candidate.status,
		startedAt: candidate.startedAt,
		endedAt: typeof candidate.endedAt === 'number' && Number.isFinite(candidate.endedAt) ? candidate.endedAt : undefined,
		exitCode: typeof candidate.exitCode === 'number' && Number.isFinite(candidate.exitCode) ? candidate.exitCode : undefined
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

export function startDeliveryRun(
	state: DeliveryState,
	stageId: DeliveryStageId,
	task: DeliveryTaskBinding,
	id: string,
	now: number = Date.now()
): DeliveryState {
	return {
		...setStageStatus(state, stageId, 'running', now),
		runs: [{ id, stageId, task, status: 'running' as const, startedAt: now }, ...state.runs].slice(0, 20)
	};
}

export function finishDeliveryRun(
	state: DeliveryState,
	id: string,
	exitCode: number | undefined,
	now: number = Date.now()
): DeliveryState {
	return {
		...state,
		runs: state.runs.map(run => run.id === id ? {
			...run,
			status: exitCode === 0 ? 'succeeded' as const : 'failed' as const,
			endedAt: now,
			exitCode
		} : run),
		updatedAt: now
	};
}
