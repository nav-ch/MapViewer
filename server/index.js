const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for development, will configure properly for plugin
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/layers', require('./routes/layers'));
app.use('/api/maps', require('./routes/maps'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/viewer', require('./routes/viewer'));
app.use('/api/proxy', require('./routes/proxy'));

// Start Server
app.listen(port, () => {
    console.log(`MapViewer Backend running on port ${port}`);
});
