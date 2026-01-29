import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

export const OSMProvider = {
    type: 'OSM',
    name: 'OpenStreetMap',
    description: 'Standard OpenStreetMap Layer',

    schema: {
        fields: [
            { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.1, default: 1 },
            { name: 'visible', type: 'boolean', label: 'Visible', default: true }
        ]
    },

    create: (config) => {
        const { opacity, visible } = config;
        return new TileLayer({
            source: new OSM(),
            opacity: opacity ?? 1,
            visible: visible ?? true
        });
    }
};
