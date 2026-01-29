const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/keys',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer dev_token'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const keys = JSON.parse(data);
            console.log('Keys count:', keys.length);
            if (keys.length > 0) {
                const firstKey = keys[0];
                console.log('First Key allowed_hosts:', firstKey.allowed_hosts);
                if (firstKey.hasOwnProperty('allowed_hosts')) {
                    console.log('SUCCESS: API returns allowed_hosts');
                } else {
                    console.log('FAILURE: API missing allowed_hosts');
                }
            } else {
                console.log('No keys found');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
