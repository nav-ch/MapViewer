// Import Registry to handle creation
import { layerRegistry } from './layer-registry';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

/**
 * Creates an OpenLayers layer from a basemap configuration object
 * @param {Object} config The basemap config from the API
 * @returns {TileLayer}
 */
export function createBasemapLayer(config) {
    let type = config.type?.toUpperCase().replace(/_/g, '').replace(/ /g, '');

    // Normalize Type Names for Registry Match
    if (type === 'ARCGIS') type = 'ARCGIS_REST';
    if (type === 'ARCGISREST') type = 'ARCGIS_REST';

    // Use the registry to create the layer
    // We pass a dummy context with no rootApiUrl for now as basemaps usually don't need proxying
    // If they do, we'd need to pass the context down or assume direct access
    const layer = layerRegistry.createLayer({ ...config, type }, {});

    if (layer) {
        // Ensure it's treated as a basemap property-wise
        layer.setProperties({
            id: 'basemap',
            basemapId: config.id,
            name: config.name
        });
        return layer;
    }

    console.warn(`[MapViewer] Unsupported basemap type via Registry: ${config.type}. Falling back to OSM.`);
    return new TileLayer({
        source: new OSM(),
        properties: {
            id: 'basemap',
            basemapId: config.id,
            name: 'OpenStreetMap'
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
