/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DeliveryStageId, DeliveryStageStatus, isDeliveryStageId } from './deliveryModel';

export interface DeliveryPanelStage {
	readonly id: DeliveryStageId;
	readonly label: string;
	readonly description: string;
	readonly status: DeliveryStageStatus;
	readonly active: boolean;
	readonly task?: string;
}

export interface DeliveryPanelRun {
	readonly stage: string;
	readonly task: string;
	readonly status: 'running' | 'succeeded' | 'failed';
	readonly startedAt: number;
	readonly endedAt?: number;
}

export interface DeliveryPanelArtifact {
	readonly path: string;
	readonly label: string;
	readonly detail: string;
}

export interface DeliveryPanelState {
	readonly workspaceName: string;
	readonly trusted: boolean;
	readonly stages: readonly DeliveryPanelStage[];
	readonly runs: readonly DeliveryPanelRun[];
	readonly artifacts: readonly DeliveryPanelArtifact[];
}

export type DeliveryPanelAction =
	| { readonly type: 'selectStage'; readonly stageId: DeliveryStageId }
	| { readonly type: 'runStage'; readonly stageId: DeliveryStageId }
	| { readonly type: 'openAgent'; readonly stageId: DeliveryStageId }
	| { readonly type: 'configureTask'; readonly stageId: DeliveryStageId }
	| { readonly type: 'markComplete'; readonly stageId: DeliveryStageId }
	| { readonly type: 'markBlocked'; readonly stageId: DeliveryStageId }
	| { readonly type: 'setupWorkspace' }
	| { readonly type: 'reset' }
	| { readonly type: 'openArtifact'; readonly path: string }
	| { readonly type: 'refresh' };

export class DeliveryPanel implements vscode.Disposable {
	private panel: vscode.WebviewPanel | undefined;
	private state: DeliveryPanelState | undefined;
	private readonly actionEmitter = new vscode.EventEmitter<DeliveryPanelAction>();
	readonly onDidReceiveAction = this.actionEmitter.event;

	dispose(): void {
		this.panel?.dispose();
		this.actionEmitter.dispose();
	}

	show(state: DeliveryPanelState): void {
		this.state = state;
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			this.postState();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'projectcollab.delivery.center',
			vscode.l10n.t('Delivery Center'),
			vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		this.panel.webview.html = this.html();
		this.panel.webview.onDidReceiveMessage(message => this.onMessage(message));
		this.panel.onDidDispose(() => this.panel = undefined);
		this.postState();
	}

	update(state: DeliveryPanelState): void {
		this.state = state;
		this.postState();
	}

	private postState(): void {
		if (this.panel && this.state) {
			void this.panel.webview.postMessage({ type: 'state', value: this.state });
		}
	}

	private onMessage(message: unknown): void {
		if (!message || typeof message !== 'object' || typeof (message as { type?: unknown }).type !== 'string') {
			return;
		}
		const candidate = message as { type: string; stageId?: unknown; path?: unknown };
		if (candidate.type === 'openArtifact' && typeof candidate.path === 'string') {
			this.actionEmitter.fire({ type: candidate.type, path: candidate.path });
			return;
		}
		if (candidate.type === 'selectStage' || candidate.type === 'runStage' || candidate.type === 'openAgent' || candidate.type === 'configureTask' || candidate.type === 'markComplete' || candidate.type === 'markBlocked') {
			if (typeof candidate.stageId === 'string' && isDeliveryStageId(candidate.stageId)) {
				this.actionEmitter.fire({ type: candidate.type, stageId: candidate.stageId });
			}
			return;
		}
		if (candidate.type === 'setupWorkspace' || candidate.type === 'reset' || candidate.type === 'refresh') {
			this.actionEmitter.fire({ type: candidate.type });
		}
	}

	private html(): string {
		const nonce = this.nonce();
		const labels = JSON.stringify({
			product: vscode.l10n.t('ProjectCollab'),
			title: vscode.l10n.t('Delivery Center'),
			subtitle: vscode.l10n.t('Turn an idea into verified, release-ready software without leaving the IDE.'),
			progress: vscode.l10n.t('Delivery progress'),
			currentStage: vscode.l10n.t('Current stage'),
			configuredTask: vscode.l10n.t('Verification task'),
			noTask: vscode.l10n.t('No task configured'),
			runStage: vscode.l10n.t('Run Stage'),
			agent: vscode.l10n.t('Work With Agent'),
			configure: vscode.l10n.t('Configure Task'),
			complete: vscode.l10n.t('Mark Complete'),
			block: vscode.l10n.t('Mark Blocked'),
			setup: vscode.l10n.t('Set Up Workspace'),
			reset: vscode.l10n.t('Reset'),
			refresh: vscode.l10n.t('Refresh'),
			activity: vscode.l10n.t('Recent activity'),
			noActivity: vscode.l10n.t('Run a stage to create an evidence trail.'),
			artifacts: vscode.l10n.t('Delivery artifacts'),
			noArtifacts: vscode.l10n.t('Generated plans, reports, and release evidence appear here.'),
			trusted: vscode.l10n.t('Workspace ready'),
			untrusted: vscode.l10n.t('Trust this workspace to run delivery tasks.'),
			pending: vscode.l10n.t('Pending'),
			running: vscode.l10n.t('Running'),
			completed: vscode.l10n.t('Completed'),
			blocked: vscode.l10n.t('Blocked'),
			succeeded: vscode.l10n.t('Succeeded'),
			failed: vscode.l10n.t('Failed'),
			open: vscode.l10n.t('Open'),
			stages: vscode.l10n.t('Pipeline')
		}).replace(/</g, '\\u003c');
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<title>${vscode.l10n.t('Delivery Center')}</title>
	<style nonce="${nonce}">
		:root { color-scheme: light dark; }
		* { box-sizing: border-box; }
		body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 13px/1.5 var(--vscode-font-family); }
		.shell { max-width: 1180px; margin: 0 auto; padding: 34px 38px 56px; }
		.hero { position: relative; overflow: hidden; padding: 30px 32px; border: 1px solid var(--vscode-widget-border); border-radius: 16px; background: linear-gradient(125deg, color-mix(in srgb, var(--vscode-button-background) 22%, var(--vscode-editor-background)), var(--vscode-editor-background) 62%); }
		.hero::after { content: ''; position: absolute; width: 260px; height: 260px; right: -95px; top: -145px; border-radius: 50%; border: 38px solid color-mix(in srgb, var(--vscode-button-background) 25%, transparent); }
		.eyebrow { color: var(--vscode-button-background); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
		h1 { font-size: 30px; line-height: 1.15; margin: 7px 0 8px; font-weight: 650; }
		.hero p { max-width: 680px; margin: 0; color: var(--vscode-descriptionForeground); font-size: 14px; }
		.hero-meta { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
		.pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border-radius: 999px; background: color-mix(in srgb, var(--vscode-editor-background) 78%, transparent); border: 1px solid var(--vscode-widget-border); }
		.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-testing-iconPassed); }
		.dot.untrusted { background: var(--vscode-testing-iconFailed); }
		.section-title { display: flex; align-items: center; justify-content: space-between; margin: 30px 0 12px; }
		.section-title h2 { font-size: 16px; margin: 0; font-weight: 650; }
		.pipeline { display: grid; grid-template-columns: repeat(6, minmax(105px, 1fr)); gap: 8px; }
		.stage { position: relative; min-height: 96px; padding: 13px; text-align: left; color: var(--vscode-foreground); border: 1px solid var(--vscode-widget-border); border-radius: 10px; background: var(--vscode-sideBar-background); cursor: pointer; }
		.stage:hover { border-color: var(--vscode-focusBorder); }
		.stage.active { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; background: color-mix(in srgb, var(--vscode-focusBorder) 10%, var(--vscode-sideBar-background)); }
		.stage-index { color: var(--vscode-descriptionForeground); font-size: 11px; }
		.stage-label { display: block; margin-top: 6px; font-weight: 650; }
		.stage-status { display: inline-block; margin-top: 8px; font-size: 11px; color: var(--vscode-descriptionForeground); }
		.stage.completed .stage-status { color: var(--vscode-testing-iconPassed); }
		.stage.blocked .stage-status { color: var(--vscode-testing-iconFailed); }
		.stage.running .stage-status { color: var(--vscode-charts-yellow); }
		.progress-track { height: 7px; margin-top: 14px; overflow: hidden; background: var(--vscode-progressBar-background); opacity: .28; border-radius: 99px; }
		.progress-fill { height: 100%; background: var(--vscode-testing-iconPassed); border-radius: inherit; transition: width .25s ease; }
		.grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .75fr); gap: 18px; margin-top: 18px; }
		.card { border: 1px solid var(--vscode-widget-border); border-radius: 12px; background: var(--vscode-sideBar-background); padding: 20px; }
		.focus h2 { margin: 3px 0 6px; font-size: 24px; font-weight: 650; }
		.focus p { color: var(--vscode-descriptionForeground); min-height: 40px; margin: 0 0 18px; }
		.task { padding: 12px 14px; border-radius: 8px; background: var(--vscode-textCodeBlock-background); }
		.task-label { display: block; color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
		.task-name { display: block; margin-top: 3px; font-family: var(--vscode-editor-font-family); }
		.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
		button { font: inherit; }
		.action { border: 1px solid var(--vscode-button-border, transparent); padding: 7px 12px; border-radius: 5px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; }
		.action:hover { background: var(--vscode-button-hoverBackground); }
		.action.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
		.action.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		.action.ghost { color: var(--vscode-foreground); background: transparent; border-color: var(--vscode-widget-border); }
		.action:disabled { opacity: .45; cursor: not-allowed; }
		.metric { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
		.metric strong { font-size: 28px; }
		.metric span { color: var(--vscode-descriptionForeground); }
		.list { display: grid; gap: 8px; }
		.list-empty { padding: 20px 4px; color: var(--vscode-descriptionForeground); }
		.row { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border-radius: 7px; background: var(--vscode-textCodeBlock-background); }
		.row-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-descriptionForeground); }
		.row-dot.succeeded { background: var(--vscode-testing-iconPassed); }
		.row-dot.failed { background: var(--vscode-testing-iconFailed); }
		.row-dot.running { background: var(--vscode-charts-yellow); }
		.row-main { min-width: 0; }
		.row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
		.row-detail, .row-time { color: var(--vscode-descriptionForeground); font-size: 11px; }
		.link { color: var(--vscode-textLink-foreground); background: none; border: 0; cursor: pointer; padding: 4px; }
		.toolbar { display: flex; gap: 6px; }
		@media (max-width: 820px) { .shell { padding: 20px; } .pipeline { grid-template-columns: repeat(3, 1fr); } .grid { grid-template-columns: 1fr; } }
		@media (max-width: 480px) { .pipeline { grid-template-columns: repeat(2, 1fr); } .hero { padding: 22px; } }
	</style>
</head>
<body>
	<main class="shell">
		<section class="hero">
			<div class="eyebrow" id="product"></div>
			<h1 id="title"></h1>
			<p id="subtitle"></p>
			<div class="hero-meta"><span class="pill"><span class="dot" id="trustDot"></span><span id="trust"></span></span><span class="pill" id="workspace"></span></div>
		</section>
		<div class="section-title"><h2 id="pipelineTitle"></h2><div class="toolbar"><button class="action ghost" data-action="setupWorkspace" id="setup"></button><button class="action ghost" data-action="refresh" id="refresh"></button><button class="action ghost" data-action="reset" id="reset"></button></div></div>
		<section class="pipeline" id="pipeline"></section>
		<div class="progress-track" aria-label="Delivery progress"><div class="progress-fill" id="progress"></div></div>
		<section class="grid">
			<div class="card focus" id="focus"></div>
			<div class="card"><div class="metric"><span id="progressLabel"></span><strong id="progressText"></strong></div><div id="summary"></div></div>
		</section>
		<section class="grid">
			<div><div class="section-title"><h2 id="activityTitle"></h2></div><div class="list" id="activity"></div></div>
			<div><div class="section-title"><h2 id="artifactsTitle"></h2></div><div class="list" id="artifacts"></div></div>
		</section>
	</main>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const labels = ${labels};
		let current;
		const send = (type, extra = {}) => vscode.postMessage({ type, ...extra });
		const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
		const statusLabel = status => labels[status] || status;
		const timeLabel = value => value ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '';
		function render(state) {
			current = state;
			document.getElementById('product').textContent = labels.product;
			document.getElementById('title').textContent = labels.title;
			document.getElementById('subtitle').textContent = labels.subtitle;
			document.getElementById('pipelineTitle').textContent = labels.stages;
			document.getElementById('setup').textContent = labels.setup;
			document.getElementById('refresh').textContent = labels.refresh;
			document.getElementById('reset').textContent = labels.reset;
			document.getElementById('workspace').textContent = state.workspaceName;
			document.getElementById('trust').textContent = state.trusted ? labels.trusted : labels.untrusted;
			document.getElementById('trustDot').classList.toggle('untrusted', !state.trusted);
			const completed = state.stages.filter(stage => stage.status === 'completed').length;
			const percent = Math.round((completed / state.stages.length) * 100);
			document.getElementById('progress').style.width = percent + '%';
			document.getElementById('progressLabel').textContent = labels.progress;
			document.getElementById('progressText').textContent = percent + '%';
			document.getElementById('summary').innerHTML = state.stages.map(stage => '<div class="row"><span class="row-dot ' + escapeHtml(stage.status) + '"></span><div class="row-main"><div class="row-title">' + escapeHtml(stage.label) + '</div></div><span class="row-time">' + escapeHtml(statusLabel(stage.status)) + '</span></div>').join('');
			document.getElementById('pipeline').innerHTML = state.stages.map((stage, index) => '<button class="stage ' + escapeHtml(stage.status) + (stage.active ? ' active' : '') + '" data-action="selectStage" data-stage="' + escapeHtml(stage.id) + '"><span class="stage-index">0' + (index + 1) + '</span><span class="stage-label">' + escapeHtml(stage.label) + '</span><span class="stage-status">' + escapeHtml(statusLabel(stage.status)) + '</span></button>').join('');
			const active = state.stages.find(stage => stage.active) || state.stages[0];
			document.getElementById('focus').innerHTML = '<span class="task-label">' + escapeHtml(labels.currentStage) + '</span><h2>' + escapeHtml(active.label) + '</h2><p>' + escapeHtml(active.description) + '</p><div class="task"><span class="task-label">' + escapeHtml(labels.configuredTask) + '</span><span class="task-name">' + escapeHtml(active.task || labels.noTask) + '</span></div><div class="actions"><button class="action" data-action="runStage" data-stage="' + escapeHtml(active.id) + '"' + (!state.trusted || active.status === 'running' ? ' disabled' : '') + '>' + escapeHtml(labels.runStage) + '</button><button class="action secondary" data-action="openAgent" data-stage="' + escapeHtml(active.id) + '">' + escapeHtml(labels.agent) + '</button><button class="action ghost" data-action="configureTask" data-stage="' + escapeHtml(active.id) + '">' + escapeHtml(labels.configure) + '</button><button class="action ghost" data-action="markComplete" data-stage="' + escapeHtml(active.id) + '">' + escapeHtml(labels.complete) + '</button><button class="action ghost" data-action="markBlocked" data-stage="' + escapeHtml(active.id) + '">' + escapeHtml(labels.block) + '</button></div>';
			document.getElementById('activityTitle').textContent = labels.activity;
			document.getElementById('activity').innerHTML = state.runs.length ? state.runs.map(run => '<div class="row"><span class="row-dot ' + escapeHtml(run.status) + '"></span><div class="row-main"><div class="row-title">' + escapeHtml(run.stage) + ' - ' + escapeHtml(statusLabel(run.status)) + '</div><div class="row-detail">' + escapeHtml(run.task) + '</div></div><span class="row-time">' + escapeHtml(timeLabel(run.endedAt || run.startedAt)) + '</span></div>').join('') : '<div class="list-empty">' + escapeHtml(labels.noActivity) + '</div>';
			document.getElementById('artifactsTitle').textContent = labels.artifacts;
			document.getElementById('artifacts').innerHTML = state.artifacts.length ? state.artifacts.map(artifact => '<div class="row"><span class="row-dot succeeded"></span><div class="row-main"><div class="row-title">' + escapeHtml(artifact.label) + '</div><div class="row-detail">' + escapeHtml(artifact.detail) + '</div></div><button class="link" data-action="openArtifact" data-path="' + escapeHtml(artifact.path) + '">' + escapeHtml(labels.open) + '</button></div>').join('') : '<div class="list-empty">' + escapeHtml(labels.noArtifacts) + '</div>';
		}
		document.addEventListener('click', event => {
			const target = event.target.closest('[data-action]');
			if (!target || target.disabled) { return; }
			const action = target.dataset.action;
			if (action === 'openArtifact') { send(action, { path: target.dataset.path }); return; }
			if (target.dataset.stage) { send(action, { stageId: target.dataset.stage }); return; }
			send(action);
		});
		window.addEventListener('message', event => { if (event.data.type === 'state') { render(event.data.value); } });
	</script>
</body>
</html>`;
	}

	private nonce(): string {
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let value = '';
		for (let index = 0; index < 32; index++) {
			value += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return value;
	}
}
