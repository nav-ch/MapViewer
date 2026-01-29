import TileLayer from 'ol/layer/Tile';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { get as getProjection } from 'ol/proj';
import { getWidth, getTopLeft } from 'ol/extent';
import { WMTSCapabilities } from 'ol/format';

export const WMTSProvider = {
    type: 'WMTS',
    name: 'Web Map Tile Service (WMTS)',
    description: 'OGC Web Map Tile Service (Pre-cached)',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'Service URL', required: true },
            { name: 'layer', type: 'string', label: 'Layer Name', required: true },
            { name: 'matrixSet', type: 'string', label: 'Matrix Set', default: 'EPSG:3857' },
            { name: 'format', type: 'string', label: 'Image Format', default: 'image/png' },
            { name: 'style', type: 'string', label: 'Style', default: 'default' },
            { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.1, default: 1 },
            { name: 'visible', type: 'boolean', label: 'Visible', default: true }
        ]
    },

    create: (config, context) => {
        const { url, params, opacity, visible, projection } = config;

        let tileGrid;
        const layerProjStr = projection || 'EPSG:3857';
        const layerProj = getProjection(layerProjStr);
        const projectionExtent = layerProj.getExtent();

        if (params.matrixIds && params.resolutions) {
            // Use provided configuration from capabilities
            tileGrid = new WMTSTileGrid({
                origin: params.origin || getTopLeft(projectionExtent),
                resolutions: params.resolutions,
                matrixIds: params.matrixIds
            });
        } else {
            // Default WebMercator TileGrid fallback
            // This is a naive heuristic, mainly for EPSG:3857
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

        return new TileLayer({
            source: new WMTS({
                url: url,
                layer: params.layer || 'layer',
                matrixSet: params.matrixSet || layerProjStr,
                format: params.format || 'image/png',
                projection: layerProj,
                tileGrid: tileGrid,
                style: params.style || 'default',
                wrapX: true,
                crossOrigin: 'anonymous'
            }),
            opacity: opacity ?? 1,
            visible: visible ?? true
        });
    },

    getCapabilities: async (url) => {
        const parser = new WMTSCapabilities();
        const response = await fetch(url.includes('?') ? url : url + '?service=WMTS&request=GetCapabilities');
        const text = await response.text();
        return parser.read(text);
    }
};
