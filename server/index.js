const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const path = require('path');

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow resources to be loaded by other origins
}));
app.use(cors({
    origin: '*', // For development, allow all. In production this should be restricted.
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Serve Static Files

// Serve Admin Panel at /admin
app.use('/admin', express.static(path.join(__dirname, '../admin/dist')));

// Serve Plugin/Viewer at root
app.use(express.static(path.join(__dirname, '../plugin/dist')));

// API Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/layers', require('./routes/layers'));
app.use('/api/maps', require('./routes/maps'));
app.use('/api/basemaps', require('./routes/basemaps'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/viewer', require('./routes/viewer'));
app.use('/api/proxy', require('./routes/proxy'));

app.get(/^\/admin\/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/dist/index.html'));
});

// Start Server
app.listen(port, () => {
    console.log(`MapViewer Backend running on port ${port}`);
});
