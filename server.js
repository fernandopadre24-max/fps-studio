const express = require('express');
const path = require('path');
const apiHandler = require('./api/[action].js');
const { initDb } = require('./api/db');

const app = express();
app.use(express.json({ limit: '50mb' })); // Support for audio payloads

// Emulate Vercel API routing
app.all('/api/:action', (req, res) => {
    req.query.action = req.params.action;
    return apiHandler(req, res);
});

// Serve static files (HTML, CSS, JS) from the root directory
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        await initDb();
        console.log(`Server running on port ${PORT} with DB initialized`);
    } catch(err) {
        console.error('Failed to init DB on startup:', err);
    }
});
