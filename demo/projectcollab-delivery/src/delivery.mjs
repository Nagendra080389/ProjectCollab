export const deliveryItems = [
	{ id: 'PC-101', title: 'Shared release readiness', owner: 'Maya', status: 'Build', risk: 'Low' },
	{ id: 'PC-102', title: 'Evidence trail in Delivery Center', owner: 'Arun', status: 'Test', risk: 'Medium' },
	{ id: 'PC-103', title: 'Release approval guardrail', owner: 'Lena', status: 'Release', risk: 'Low' },
	{ id: 'PC-104', title: 'Workspace task discovery', owner: 'Noah', status: 'Done', risk: 'Low' }
];

export function calculateProgress(items) {
	if (items.length === 0) {
		return 0;
	}
	const weights = { Discover: 0.1, Plan: 0.25, Design: 0.4, Build: 0.6, Test: 0.8, Release: 0.95, Done: 1 };
	const total = items.reduce((sum, item) => sum + (weights[item.status] ?? 0), 0);
	return Math.round((total / items.length) * 100);
}

export function summarizeDelivery(items) {
	return {
		progress: calculateProgress(items),
		active: items.filter(item => item.status !== 'Done').length,
		atRisk: items.filter(item => item.risk === 'High' || item.risk === 'Medium').length,
		items
	};
}
