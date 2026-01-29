import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import TileArcGISRest from 'ol/source/TileArcGISRest';
import ImageArcGISRest from 'ol/source/ImageArcGISRest';

export const ArcGISRestProvider = {
    type: 'ARCGIS_REST',
    name: 'ArcGIS REST Map Service',
    description: 'Esri ArcGIS REST Map Service Layer',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'Service URL', required: true },
            { name: 'layers', type: 'string', label: 'Layers to Show (e.g. show:1,2)', placeholder: 'Optional' },
            { name: 'tiled', type: 'boolean', label: 'Tiled (Export Tiles)', default: true },
            { name: 'use_proxy', type: 'boolean', label: 'Use Proxy', default: false },
            { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.1, default: 1 },
            { name: 'visible', type: 'boolean', label: 'Visible', default: true }
        ]
    },

    create: (config, context) => {
        const { url, params, opacity, visible, projection } = config;
        const { rootApiUrl } = context || {};

        const isProxied = params?.use_proxy;
        const finalUrl = isProxied && rootApiUrl ? `${rootApiUrl}/api/proxy?url=${encodeURIComponent(url)}` : url;
        const layerProj = projection || 'EPSG:3857';
        const isTiled = params?.tiled !== false; // Default to true

        const arcgisParams = {
            ...(typeof params === 'object' ? params : {}),
            'LAYERS': params?.layers ? `show:${params.layers}` : undefined
        };

        if (isTiled) {
            return new TileLayer({
                source: new TileArcGISRest({
                    url: finalUrl,
                    params: arcgisParams,
                    projection: layerProj,
                    crossOrigin: 'anonymous'
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });
        } else {
            return new ImageLayer({
                source: new ImageArcGISRest({
                    url: finalUrl,
                    params: arcgisParams,
                    ratio: 1,
                    projection: layerProj,
                    crossOrigin: 'anonymous'
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });
        }
    },

    getCapabilities: async (url) => {
        const response = await fetch(url.includes('f=json') ? url : (url.includes('?') ? url + '&f=json' : url + '?f=json'));
        return await response.json();
    }
};
