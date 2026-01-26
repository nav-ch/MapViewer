import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';

/**
 * Creates an OpenLayers layer from a basemap configuration object
 * @param {Object} config The basemap config from the API
 * @returns {TileLayer}
 */
export function createBasemapLayer(config) {
    let source;

    switch (config.type?.toUpperCase()) {
        case 'OSM':
            source = new OSM();
            break;
        case 'XYZ':
            source = new XYZ({
                url: config.url,
                crossOrigin: 'anonymous'
            });
            break;
        case 'WMS':
            const params = typeof config.params === 'string' ? JSON.parse(config.params) : (config.params || {});
            source = new TileWMS({
                url: config.url,
                params: {
                    'LAYERS': params.layers || '',
                    'TILED': true,
                    'TRANSPARENT': true,
                    ...params
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
            });
            break;
        default:
            console.warn(`[MapViewer] Unsupported basemap type: ${config.type}. Falling back to OSM.`);
            source = new OSM();
    }

    return new TileLayer({
        source: source,
        properties: {
            id: 'basemap',
            basemapId: config.id,
            name: config.name
        }
    });
}

// Legacy support for any existing code using BASEMAPS object
export const BASEMAPS = {
    'OSM': {
        name: 'OpenStreetMap',
        create: () => createBasemapLayer({ type: 'OSM', name: 'OpenStreetMap' })
    }
};
