/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DELIVERY_STAGE_IDS, DeliveryStageId, DeliveryStageState, DeliveryState } from './deliveryModel';

export interface DeliveryStageNode {
	readonly kind: 'stage';
	readonly id: DeliveryStageId;
}

export function stageLabel(stageId: DeliveryStageId): string {
	switch (stageId) {
		case 'discover': return vscode.l10n.t('Discover');
		case 'plan': return vscode.l10n.t('Plan');
		case 'design': return vscode.l10n.t('Design');
		case 'build': return vscode.l10n.t('Build');
		case 'test': return vscode.l10n.t('Test');
		case 'release': return vscode.l10n.t('Release');
	}
}

export function stageDescription(stageId: DeliveryStageId): string {
	switch (stageId) {
		case 'discover': return vscode.l10n.t('Clarify the problem, users, constraints, and success measures.');
		case 'plan': return vscode.l10n.t('Define scope, milestones, risks, ownership, and acceptance criteria.');
		case 'design': return vscode.l10n.t('Establish architecture, interfaces, data flow, and delivery decisions.');
		case 'build': return vscode.l10n.t('Implement the planned change and keep the workspace buildable.');
		case 'test': return vscode.l10n.t('Validate behavior, quality, security, and release readiness.');
		case 'release': return vscode.l10n.t('Package, approve, publish, and verify the delivered change.');
	}
}

export class DeliveryTreeDataProvider implements vscode.TreeDataProvider<DeliveryStageNode> {
	private readonly changeEmitter = new vscode.EventEmitter<DeliveryStageNode | undefined>();
	readonly onDidChangeTreeData = this.changeEmitter.event;

	constructor(private readonly getState: () => DeliveryState) { }

	dispose(): void {
		this.changeEmitter.dispose();
	}

	refresh(): void {
		this.changeEmitter.fire(undefined);
	}

	getTreeItem(element: DeliveryStageNode): vscode.TreeItem {
		const state = this.getState();
		const stage = state.stages.find(candidate => candidate.id === element.id) ?? { id: element.id, status: 'pending' };
		const item = new vscode.TreeItem(stageLabel(stage.id), vscode.TreeItemCollapsibleState.None);
		const descriptions: string[] = [];
		if (state.activeStage === stage.id) {
			descriptions.push(vscode.l10n.t('Current'));
		}
		if (stage.task) {
			descriptions.push(stage.task.name);
		}
		item.description = descriptions.join(' · ');
		item.tooltip = this.tooltipFor(stage, state.activeStage === stage.id);
		item.iconPath = new vscode.ThemeIcon(this.iconFor(stage, state.activeStage === stage.id));
		item.contextValue = 'projectcollabDeliveryStage';
		item.command = {
			command: 'projectcollab.delivery.selectStage',
			title: vscode.l10n.t('Set as Current Stage'),
			arguments: [element]
		};
		return item;
	}

	getChildren(): DeliveryStageNode[] {
		return DELIVERY_STAGE_IDS.map(id => ({ kind: 'stage', id }));
	}

	private iconFor(stage: DeliveryStageState, active: boolean): string {
		switch (stage.status) {
			case 'running': return 'loading~spin';
			case 'completed': return 'pass-filled';
			case 'blocked': return 'error';
			case 'pending': return active ? 'arrow-right' : 'circle-outline';
		}
	}

	private tooltipFor(stage: DeliveryStageState, active: boolean): string {
		const status = active && stage.status === 'pending' ? vscode.l10n.t('Current') : this.statusLabel(stage.status);
		const task = stage.task
			? vscode.l10n.t('Task: {0} ({1})', stage.task.name, stage.task.source)
			: vscode.l10n.t('No task configured');
		return `${stageDescription(stage.id)}\n\n${vscode.l10n.t('Status: {0}', status)}\n${task}`;
	}

	private statusLabel(status: DeliveryStageState['status']): string {
		switch (status) {
			case 'pending': return vscode.l10n.t('Pending');
			case 'running': return vscode.l10n.t('Running');
			case 'completed': return vscode.l10n.t('Completed');
			case 'blocked': return vscode.l10n.t('Blocked');
		}
	}
}
