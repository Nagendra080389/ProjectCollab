import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { deliveryItems, summarizeDelivery } from './delivery.mjs';

const port = Number(process.env.PORT || 4173);
const publicRoot = join(process.cwd(), 'public');
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = createServer(async (request, response) => {
	if (request.url === '/api/delivery') {
		response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
		response.end(JSON.stringify(summarizeDelivery(deliveryItems)));
		return;
	}
	if (request.url === '/api/health') {
		response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
		response.end(JSON.stringify({ status: 'ready', service: 'ProjectPulse' }));
		return;
	}
	try {
		const requested = request.url === '/' ? 'index.html' : String(request.url).split('?')[0].replace(/^\/+/, '');
		const filePath = normalize(join(publicRoot, requested));
		if (!filePath.startsWith(publicRoot) || !(await stat(filePath)).isFile()) {
			throw new Error('Not found');
		}
		response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
		response.end(await readFile(filePath));
	} catch {
		response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
		response.end('Not found');
	}
});

console.log('Starting ProjectPulse demo server...');
server.listen(port, '127.0.0.1', () => console.log(`ProjectPulse is ready at http://127.0.0.1:${port}`));
