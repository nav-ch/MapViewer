const http = require('http');

const mapId = '161744af-1da0-4aee-979a-075c02162fec'; // From user's HTML
const apiKey = 'mv_example_key'; // From user's HTML

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/viewer/${mapId}`,
    method: 'GET',
    headers: {
        'x-api-key': apiKey
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const config = JSON.parse(data);
            console.log('Map Config Status:', res.statusCode);
            if (res.statusCode === 200) {
                console.log('Layers found:', config.layers.length);
                config.layers.forEach((l, i) => {
                    console.log(`Layer ${i}:`);
                    console.log(`  Name: ${l.name}`);
                    console.log(`  Type: '${l.type}'`);
                    console.log(`  Params Type: ${typeof l.params}`);
                    console.log(`  Params:`, JSON.stringify(l.params, null, 2));
                });
            } else {
                console.log('Error:', data);
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
