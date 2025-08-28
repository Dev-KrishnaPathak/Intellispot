import app from './app.js';

const PORT = process.env.PORT || 5000;

function listen(port, attempt = 0) {
	const server = app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
	server.on('error', err => {
		if (err.code === 'EADDRINUSE' && attempt < 3) {
			const nextPort = port + 1;
			console.warn(`Port ${port} in use, trying ${nextPort}...`);
			listen(nextPort, attempt + 1);
		} else {
			console.error('Failed to start server:', err);
			process.exit(1);
		}
	});
}

listen(Number(PORT));
