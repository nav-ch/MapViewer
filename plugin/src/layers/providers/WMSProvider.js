import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import TileWMS from 'ol/source/TileWMS';
import ImageWMS from 'ol/source/ImageWMS';
import { WMSCapabilities } from 'ol/format';

export const WMSProvider = {
    type: 'WMS',
    name: 'Web Map Service (WMS)',
    description: 'OGC Web Map Service Layer (Tiled or Image)',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'Service URL', required: true },
            { name: 'layers', type: 'string', label: 'Layers (comma-separated)', required: true },
            { name: 'tiled', type: 'boolean', label: 'Tiled (Pre-cached)', default: true },
            { name: 'legend_url', type: 'url', label: 'Legend URL' },
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

        const wmsParams = {
            ...(typeof params === 'object' ? params : {}),
            'LAYERS': params?.layers || '',
            'TILED': isTiled,
            'TRANSPARENT': true
        };

        if (isTiled) {
            return new TileLayer({
                source: new TileWMS({
                    url: finalUrl,
                    params: wmsParams,
                    serverType: 'geoserver',
                    transition: 0,
                    projection: layerProj,
                    crossOrigin: 'anonymous'
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });
        } else {
            return new ImageLayer({
                source: new ImageWMS({
                    url: finalUrl,
                    params: wmsParams,
                    serverType: 'geoserver',
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
        const parser = new WMSCapabilities();
        const response = await fetch(url.includes('?') ? url : url + '?service=WMS&request=GetCapabilities');
        const text = await response.text();
        return parser.read(text);
    }
};
