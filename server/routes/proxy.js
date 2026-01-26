const express = require('express');
const router = express.Router();
const axios = require('axios');

// Proxy endpoint to bypass CORS
router.get('/', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // Forward the request to the target URL
        // We exclude the 'url' param from being forwarded back to the target itself
        const targetUrl = new URL(url);
        Object.keys(req.query).forEach(key => {
            if (key !== 'url') {
                targetUrl.searchParams.append(key, req.query[key]);
            }
        });

        const response = await axios({
            method: 'get',
            url: targetUrl.toString(),
            responseType: 'arraybuffer', // Handle binary data like images or octet-streams
            headers: {
                'User-Agent': 'MapViewer-Proxy/1.0'
            },
            timeout: 30000 // 30 second timeout
        });

        // Forward content-type and other relevant headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Explicitly allow sharing for the image resources
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        res.send(response.data);
    } catch (err) {
        console.error('Proxy Error:', err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to proxy request',
            details: err.message
        });
    }
});

module.exports = router;
