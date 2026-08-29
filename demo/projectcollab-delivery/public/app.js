const response = await fetch('/api/delivery');
const delivery = await response.json();

document.querySelector('#progress').textContent = `${delivery.progress}%`;
document.querySelector('#active').textContent = delivery.active;
document.querySelector('#risk').textContent = delivery.atRisk;
document.querySelector('#items').innerHTML = delivery.items.map(item => `
	<div class="table-row">
		<span><b>${item.id}</b>${item.title}</span>
		<span><i class="person">${item.owner.slice(0, 1)}</i>${item.owner}</span>
		<span><em class="stage">${item.status}</em></span>
		<span><em class="risk ${item.risk.toLowerCase()}">${item.risk}</em></span>
	</div>`).join('');
