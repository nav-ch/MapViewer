const db = require('./server/db');

async function repairLayers() {
    try {
        // Fix bluemarblewms and others
        const bluemarbleParams = {
            layers: 'topp:states,usa:states',
            identify_fields: 'STATE_NAME,STATE_ABBR',
            legend_url: 'https://demo.boundary.org/geoserver/wms?request=GetLegendGraphic&format=image/png&layer=topp:states',
            use_proxy: false
        };

        await db.query(
            "UPDATE layers SET params = $1 WHERE name = 'bluemarblewms'",
            [JSON.stringify(bluemarbleParams)]
        );

        console.log('Database repair complete.');
    } catch (err) {
        console.error('Repair failed:', err);
    }
}

repairLayers();
