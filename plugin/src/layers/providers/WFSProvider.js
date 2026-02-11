import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { parseStyle } from '../../utils/style-parser';

export const WFSProvider = {
    type: 'WFS',
    name: 'Web Feature Service (WFS)',
    description: 'OGC Web Feature Service Vector Layer',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'Service URL', required: true },
            { name: 'typeName', type: 'string', label: 'Feature Type Name', required: true },
            { name: 'use_proxy', type: 'boolean', label: 'Use Proxy', default: false },
            { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.1, default: 1 },
            { name: 'visible', type: 'boolean', label: 'Visible', default: true }
        ]
    },

    create: (config, context) => {
        const { url, params = {}, opacity, visible, projection } = config;
        const { rootApiUrl } = context || {};

        const isProxied = params?.use_proxy;
        const finalUrl = url; // Base URL is usually just passed to the loader
        const layerProj = projection || 'EPSG:3857';

        return new VectorLayer({
            source: new VectorSource({
                format: new GeoJSON(),
                url: function (extent) {
                    const baseUrl = finalUrl + ((finalUrl.includes('?') ? '&' : '?'));
                    // Construct proxy logic if needed for the FULL request, but here we construct the URL string for WFS
                    // If using proxy, the WHOLE WFS request needs to be encoded.

                    let wfsUrl = baseUrl +
                        'service=WFS&' +
                        'version=1.1.0&request=GetFeature&typename=' + (params.layers || params.typeName) +
                        '&outputFormat=application/json&srsname=' + layerProj + '&' +
                        'bbox=' + extent.join(',') + ',' + layerProj;

                    if (isProxied && rootApiUrl) {
                        return `${rootApiUrl}/api/proxy?url=${encodeURIComponent(wfsUrl)}`;
                    }
                    return wfsUrl;
                },
                strategy: bboxStrategy,
            }),
            opacity: opacity ?? 1,
            visible: visible ?? true,
            style: parseStyle(params.style || config.style)
        });

        // Store metadata for editor-tools
        layer.set('wfsUrl', finalUrl);
        layer.set('wfsParams', params);
        if (rootApiUrl) {
            layer.set('rootApiUrl', rootApiUrl);
        }

        return layer;
    }
};
