import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { createStyleFunction } from '../../utils/style-parser';

export const VectorProvider = {
    type: 'Vector',
    name: 'Vector Layer (GeoJSON)',
    description: 'Generic Vector Layer from URL or Features',

    schema: {
        fields: [
            { name: 'url', type: 'url', label: 'Data URL', required: false },
            { name: 'data', type: 'json', label: 'GeoJSON Data', required: false },
            { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.1, default: 1 },
            { name: 'visible', type: 'boolean', label: 'Visible', default: true }
        ]
    },

    create: (config, context) => {
        const { url, data, params = {}, opacity, visible, projection } = config;

        const sourceOptions = {
            format: new GeoJSON(),
        };

        if (url) {
            sourceOptions.url = url;
            // If it's a large dataset, we might want a strategy, but for generic files usually fixed strategy is default
            // sourceOptions.strategy = bboxStrategy; // Only if WFS-like behavior needed
        } else if (data) {
            // Inline data
            const features = new GeoJSON().readFeatures(data, {
                featureProjection: 'EPSG:3857', // Default map projection
                dataProjection: projection || 'EPSG:4326' // Default data projection
            });
            sourceOptions.features = features;
        }

        const layer = new VectorLayer({
            source: new VectorSource(sourceOptions),
            opacity: opacity ?? 1,
            visible: visible ?? true,
            style: createStyleFunction(params.style || config.style)
        });

        return layer;
    }
};
