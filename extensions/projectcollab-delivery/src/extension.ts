/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	bindStageTask,
	completeStage,
	createInitialDeliveryState,
	DELIVERY_STAGE_IDS,
	DeliveryStageId,
	DeliveryState,
	finishDeliveryRun,
	getStageState,
	normalizeDeliveryState,
	selectStage,
	setStageStatus,
	startDeliveryRun
} from './deliveryModel';
import { DeliveryPanel, DeliveryPanelAction, DeliveryPanelState } from './deliveryPanel';
import { DeliveryStageNode, DeliveryTreeDataProvider, stageDescription, stageLabel } from './deliveryView';

const STORAGE_KEY = 'projectcollab.delivery.state.v1';

class DeliveryController {
	private state: DeliveryState;
	private readonly runningTasks = new Map<vscode.TaskExecution, { readonly stageId: DeliveryStageId; readonly runId: string }>();
	private readonly tree: DeliveryTreeDataProvider;
	private readonly panel: DeliveryPanel;
	private readonly statusBar: vscode.StatusBarItem;
	private runCounter = 0;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.state = normalizeDeliveryState(context.workspaceState.get(STORAGE_KEY));
		this.tree = new DeliveryTreeDataProvider(() => this.state);
		this.panel = new DeliveryPanel();
		this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
		this.statusBar.command = 'projectcollab.delivery.openCenter';
		this.statusBar.name = vscode.l10n.t('Delivery Stage');
		this.refresh();

		context.subscriptions.push(
			this.tree,
			this.panel,
			this.panel.onDidReceiveAction(action => this.onPanelAction(action)),
			this.statusBar,
			vscode.window.createTreeView('projectcollab.delivery.stages', { treeDataProvider: this.tree }),
			vscode.tasks.onDidEndTaskProcess(event => this.onTaskEnded(event)),
			vscode.commands.registerCommand('projectcollab.delivery.refresh', () => this.refresh()),
			vscode.commands.registerCommand('projectcollab.delivery.openCenter', () => this.openCenter()),
			vscode.commands.registerCommand('projectcollab.delivery.setupWorkspace', () => this.setupWorkspace()),
			vscode.commands.registerCommand('projectcollab.delivery.selectStage', (node?: DeliveryStageNode) => this.select(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.configureStageTask', (node?: DeliveryStageNode) => this.configureTask(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.runStageTask', (node?: DeliveryStageNode) => this.runStageTask(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.openAgent', (node?: DeliveryStageNode) => this.openAgent(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.markComplete', (node?: DeliveryStageNode) => this.markComplete(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.markBlocked', (node?: DeliveryStageNode) => this.markBlocked(node?.id)),
			vscode.commands.registerCommand('projectcollab.delivery.reset', () => this.reset())
		);
	}

	private resolveStage(stageId?: DeliveryStageId): DeliveryStageId {
		return stageId ?? this.state.activeStage;
	}

	private async select(stageId?: DeliveryStageId): Promise<void> {
		await this.updateState(selectStage(this.state, this.resolveStage(stageId)));
	}

	private async openCenter(): Promise<void> {
		this.panel.show(await this.panelState());
	}

	private async onPanelAction(action: DeliveryPanelAction): Promise<void> {
		switch (action.type) {
			case 'selectStage': return this.select(action.stageId);
			case 'runStage': return this.runStageTask(action.stageId);
			case 'openAgent': return this.openAgent(action.stageId);
			case 'configureTask': await this.configureTask(action.stageId); return;
			case 'markComplete': return this.markComplete(action.stageId);
			case 'markBlocked': return this.markBlocked(action.stageId);
			case 'setupWorkspace': return this.setupWorkspace();
			case 'reset': return this.reset();
			case 'openArtifact': return this.openArtifact(action.path);
			case 'refresh': this.refresh(); return;
		}
	}

	private async setupWorkspace(): Promise<void> {
		const tasks = await vscode.tasks.fetchTasks();
		let nextState = this.state;
		let configured = 0;
		for (const stageId of DELIVERY_STAGE_IDS) {
			const expectedName = `Delivery: ${stageLabel(stageId)}`;
			const task = tasks.find(candidate => candidate.name === expectedName);
			if (task) {
				nextState = bindStageTask(nextState, stageId, { name: task.name, source: task.source });
				configured++;
			}
		}
		if (configured === 0) {
			void vscode.window.showWarningMessage(vscode.l10n.t('No convention-based delivery tasks were found. Add tasks named "Delivery: Discover" through "Delivery: Release", or configure each stage manually.'));
			return;
		}
		await this.updateState(nextState);
		void vscode.window.showInformationMessage(vscode.l10n.t('Configured {0} delivery stages for this workspace.', configured));
	}

	private async configureTask(stageId?: DeliveryStageId): Promise<vscode.Task | undefined> {
		const id = this.resolveStage(stageId);
		const availableTasks = await vscode.tasks.fetchTasks();
		if (availableTasks.length === 0) {
			void vscode.window.showInformationMessage(vscode.l10n.t('No VS Code tasks are available in this workspace.'));
			return undefined;
		}

		const picks = availableTasks
			.map(task => ({ label: task.name, description: task.source, task }))
			.sort((left, right) => left.label.localeCompare(right.label));
		const selected = await vscode.window.showQuickPick(picks, {
			placeHolder: vscode.l10n.t('Choose the task for the {0} stage', stageLabel(id)),
			matchOnDescription: true
		});
		if (!selected) {
			return undefined;
		}

		await this.updateState(bindStageTask(this.state, id, { name: selected.task.name, source: selected.task.source }));
		return selected.task;
	}

	private async runStageTask(stageId?: DeliveryStageId): Promise<void> {
		const id = this.resolveStage(stageId);
		if (!vscode.workspace.isTrusted) {
			void vscode.window.showWarningMessage(vscode.l10n.t('Trust this workspace before running delivery tasks.'));
			return;
		}

		if (id === 'release' && vscode.workspace.getConfiguration('projectCollab.delivery').get<boolean>('requireReleaseConfirmation', true)) {
			const run = vscode.l10n.t('Run Release Task');
			const choice = await vscode.window.showWarningMessage(
				vscode.l10n.t('The configured Release task may publish or deploy artifacts. Continue?'),
				{ modal: true },
				run
			);
			if (choice !== run) {
				return;
			}
		}

		let task = await this.findConfiguredTask(id);
		if (!task) {
			task = await this.configureTask(id);
		}
		if (!task) {
			return;
		}

		try {
			const execution = await vscode.tasks.executeTask(task);
			const runId = `${Date.now()}-${++this.runCounter}`;
			this.runningTasks.set(execution, { stageId: id, runId });
			await this.updateState(startDeliveryRun(this.state, id, { name: task.name, source: task.source }, runId));
		} catch (error) {
			await this.updateState(setStageStatus(this.state, id, 'blocked'));
			void vscode.window.showErrorMessage(vscode.l10n.t('Could not start the {0} task: {1}', stageLabel(id), this.errorMessage(error)));
		}
	}

	private async findConfiguredTask(stageId: DeliveryStageId): Promise<vscode.Task | undefined> {
		let binding = getStageState(this.state, stageId).task;
		if (!binding) {
			const conventionalName = `Delivery: ${stageLabel(stageId)}`;
			const conventionalTask = (await vscode.tasks.fetchTasks()).find(task => task.name === conventionalName);
			if (conventionalTask) {
				binding = { name: conventionalTask.name, source: conventionalTask.source };
				await this.updateState(bindStageTask(this.state, stageId, binding));
				return conventionalTask;
			}
		}
		if (!binding) {
			return undefined;
		}
		const tasks = await vscode.tasks.fetchTasks();
		const match = tasks.find(task => task.name === binding.name && task.source === binding.source);
		if (!match) {
			void vscode.window.showWarningMessage(vscode.l10n.t('The configured task "{0}" is no longer available. Choose another task.', binding.name));
		}
		return match;
	}

	private async onTaskEnded(event: vscode.TaskProcessEndEvent): Promise<void> {
		const running = this.runningTasks.get(event.execution);
		if (!running) {
			return;
		}
		this.runningTasks.delete(event.execution);
		let nextState = finishDeliveryRun(this.state, running.runId, event.exitCode);
		if (event.exitCode === 0) {
			nextState = completeStage(nextState, running.stageId);
			await this.updateState(nextState);
			void vscode.window.showInformationMessage(vscode.l10n.t('{0} completed successfully.', stageLabel(running.stageId)));
		} else {
			nextState = setStageStatus(nextState, running.stageId, 'blocked');
			await this.updateState(nextState);
			void vscode.window.showErrorMessage(vscode.l10n.t('{0} is blocked because its task exited with code {1}.', stageLabel(running.stageId), event.exitCode ?? vscode.l10n.t('unknown')));
		}
	}

	private async openAgent(stageId?: DeliveryStageId): Promise<void> {
		const id = this.resolveStage(stageId);
		await this.select(id);
		const stage = getStageState(this.state, id);
		const taskContext = stage.task
			? vscode.l10n.t('The configured verification task is "{0}" from {1}.', stage.task.name, stage.task.source)
			: vscode.l10n.t('No verification task is configured yet; recommend an appropriate workspace task before declaring the stage complete.');
		const query = vscode.l10n.t(
			'Work as the delivery agent for the {0} stage in the current workspace. {1} Inspect the repository and current work before acting. Make the smallest coherent changes needed for this stage, validate claims with concrete evidence, identify risks or blockers, and finish with a clear recommendation on whether the stage can advance. {2}',
			stageLabel(id),
			this.stageGoal(id),
			taskContext
		);
		try {
			await vscode.commands.executeCommand('workbench.action.chat.open', { mode: 'agent', query });
		} catch (error) {
			void vscode.window.showErrorMessage(vscode.l10n.t('Could not open agent mode: {0}', this.errorMessage(error)));
		}
	}

	private stageGoal(stageId: DeliveryStageId): string {
		switch (stageId) {
			case 'discover': return vscode.l10n.t('Clarify the problem, stakeholders, constraints, existing behavior, and measurable outcomes.');
			case 'plan': return vscode.l10n.t('Turn the accepted outcome into scoped milestones, acceptance criteria, dependencies, and risks.');
			case 'design': return vscode.l10n.t('Produce implementation-ready architecture and interface decisions that fit the existing codebase.');
			case 'build': return vscode.l10n.t('Implement the planned change while preserving code quality and a buildable workspace.');
			case 'test': return vscode.l10n.t('Exercise behavior, edge cases, regressions, security properties, and operational readiness.');
			case 'release': return vscode.l10n.t('Verify approvals, packaging, rollout safety, observability, and post-release checks before publishing.');
		}
	}

	private async markComplete(stageId?: DeliveryStageId): Promise<void> {
		await this.updateState(completeStage(this.state, this.resolveStage(stageId)));
	}

	private async markBlocked(stageId?: DeliveryStageId): Promise<void> {
		await this.updateState(setStageStatus(this.state, this.resolveStage(stageId), 'blocked'));
	}

	private async reset(): Promise<void> {
		const reset = vscode.l10n.t('Reset');
		const choice = await vscode.window.showWarningMessage(
			vscode.l10n.t('Reset all delivery stage progress and task assignments for this workspace?'),
			{ modal: true },
			reset
		);
		if (choice === reset) {
			await this.updateState(createInitialDeliveryState());
		}
	}

	private async updateState(state: DeliveryState): Promise<void> {
		this.state = state;
		await this.context.workspaceState.update(STORAGE_KEY, state);
		this.refresh();
	}

	private refresh(): void {
		this.tree.refresh();
		this.statusBar.text = `$(rocket) ${vscode.l10n.t('Delivery: {0}', stageLabel(this.state.activeStage))}`;
		this.statusBar.tooltip = vscode.l10n.t('Open the Delivery Center');
		this.statusBar.show();
		void this.panelState().then(state => this.panel.update(state));
	}

	private async panelState(): Promise<DeliveryPanelState> {
		const artifacts = await this.findArtifacts();
		return {
			workspaceName: vscode.workspace.name ?? vscode.l10n.t('No workspace open'),
			trusted: vscode.workspace.isTrusted,
			stages: this.state.stages.map(stage => ({
				id: stage.id,
				label: stageLabel(stage.id),
				description: stageDescription(stage.id),
				status: stage.status,
				active: stage.id === this.state.activeStage,
				task: stage.task ? `${stage.task.name} (${stage.task.source})` : undefined
			})),
			runs: this.state.runs.map(run => ({
				stage: stageLabel(run.stageId),
				task: run.task.name,
				status: run.status,
				startedAt: run.startedAt,
				endedAt: run.endedAt
			})),
			artifacts
		};
	}

	private async findArtifacts(): Promise<DeliveryPanelState['artifacts']> {
		const root = vscode.workspace.workspaceFolders?.[0];
		if (!root) {
			return [];
		}
		const pattern = new vscode.RelativePattern(root, 'delivery-artifacts/**/*');
		const files = await vscode.workspace.findFiles(pattern, undefined, 40);
		const artifacts: { path: string; label: string; detail: string; modified: number }[] = [];
		for (const file of files) {
			try {
				const stat = await vscode.workspace.fs.stat(file);
				if (stat.type === vscode.FileType.File) {
					const path = vscode.workspace.asRelativePath(file, false);
					artifacts.push({
						path,
						label: path.split('/').pop() ?? path,
						detail: vscode.l10n.t('{0} bytes', stat.size),
						modified: stat.mtime
					});
				}
			} catch {
				// The file may have been replaced while the workspace was being scanned.
			}
		}
		return artifacts.sort((left, right) => right.modified - left.modified).map(({ path, label, detail }) => ({ path, label, detail }));
	}

	private async openArtifact(path: string): Promise<void> {
		const root = vscode.workspace.workspaceFolders?.[0];
		const pathSegments = path.split('/');
		if (!root || !path.startsWith('delivery-artifacts/') || pathSegments.some(segment => !segment || segment === '.' || segment === '..')) {
			return;
		}
		const uri = vscode.Uri.joinPath(root.uri, ...pathSegments);
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(document, { preview: true });
		} catch (error) {
			void vscode.window.showErrorMessage(vscode.l10n.t('Could not open delivery artifact: {0}', this.errorMessage(error)));
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}

export function activate(context: vscode.ExtensionContext): void {
	new DeliveryController(context);
}
