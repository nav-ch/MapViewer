import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

export const XYZProvider = {
    type: 'XYZ',
    name: 'XYZ / TMS',
    description: 'Standard XYZ Tile Layer',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'URL Template (e.g. {z}/{x}/{y}.png)', required: true },
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

        return new TileLayer({
            source: new XYZ({
                url: finalUrl,
                projection: layerProj
            }),
            opacity: opacity ?? 1,
            visible: visible ?? true
        });
    }
};
