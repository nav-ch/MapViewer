import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import TileArcGISRest from 'ol/source/TileArcGISRest';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { get as getProjection } from 'ol/proj';
import { getWidth, getTopLeft } from 'ol/extent';

/**
 * Creates an OpenLayers layer from a basemap configuration object
 * @param {Object} config The basemap config from the API
 * @returns {TileLayer}
 */
export function createBasemapLayer(config) {
    let source;
    // Normalized type for looser matching (e.g. "ArcGIS Rest" -> "ARCGISREST")
    const type = config.type?.toUpperCase().replace(/_/g, '').replace(/ /g, '');

    console.log(`[MapViewer] Creating basemap: Raw="${config.type}" Normalized="${type}" URL="${config.url}"`);

    switch (type) {
        case 'OSM':
            source = new OSM();
            break;
        case 'XYZ':
            source = new XYZ({
                url: config.url,
                crossOrigin: 'anonymous'
            });
            break;
        case 'ARCGISREST': // Handles "ArcGIS_Rest", "ArcGIS Rest"
        case 'ARCGIS':
            source = new TileArcGISRest({
                url: config.url,
                crossOrigin: 'anonymous',
                params: typeof config.params === 'string' ? JSON.parse(config.params) : (config.params || {})
            });
            break;
        case 'WMTS':
            const wmtsParams = typeof config.params === 'string' ? JSON.parse(config.params) : (config.params || {});

            let tileGrid;
            const projection = getProjection('EPSG:3857');
            const projectionExtent = projection.getExtent();

            if (wmtsParams.matrixIds && wmtsParams.resolutions) {
                // Use provided configuration from capabilities
                tileGrid = new WMTSTileGrid({
                    origin: wmtsParams.origin || getTopLeft(projectionExtent),
                    resolutions: wmtsParams.resolutions,
                    matrixIds: wmtsParams.matrixIds
                });
            } else {
                // Default WebMercator TileGrid fallback
                const size = getWidth(projectionExtent) / 256;
                const resolutions = new Array(22);
                const matrixIds = new Array(22);
                for (let z = 0; z < 22; ++z) {
                    resolutions[z] = size / Math.pow(2, z);
                    matrixIds[z] = z;
                }
                tileGrid = new WMTSTileGrid({
                    origin: getTopLeft(projectionExtent),
                    resolutions: resolutions,
                    matrixIds: matrixIds
                });
            }

            source = new WMTS({
                url: config.url,
                layer: wmtsParams.layer || 'layer',
                matrixSet: wmtsParams.matrixSet || 'EPSG:3857',
                format: wmtsParams.format || 'image/png',
                projection: projection,
                tileGrid: tileGrid,
                style: wmtsParams.style || 'default',
                wrapX: true,
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
            console.warn(`[MapViewer] Unsupported basemap type: ${config.type} (Normalized: ${type}). Falling back to OSM.`);
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
