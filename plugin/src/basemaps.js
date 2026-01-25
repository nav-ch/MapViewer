import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

export const BASEMAPS = {
    'OSM': {
        name: 'OpenStreetMap',
        create: () => new TileLayer({
            source: new OSM(),
            properties: { id: 'basemap' }
        })
    },
    'GOOGLE_ROADMAP': {
        name: 'Google Roadmap',
        create: () => new TileLayer({
            source: new XYZ({
                url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            }),
            properties: { id: 'basemap' }
        })
    },
    'GOOGLE_SATELLITE': {
        name: 'Google Satellite',
        create: () => new TileLayer({
            source: new XYZ({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            }),
            properties: { id: 'basemap' }
        })
    },
    'GOOGLE_HYBRID': {
        name: 'Google Hybrid',
        create: () => new TileLayer({
            source: new XYZ({
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            }),
            properties: { id: 'basemap' }
        })
    },
    'GOOGLE_TERRAIN': {
        name: 'Google Terrain',
        create: () => new TileLayer({
            source: new XYZ({
                url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            }),
            properties: { id: 'basemap' }
        })
    },
    'CARTODB_DARK': {
        name: 'CartoDB Dark',
        create: () => new TileLayer({
            source: new XYZ({
                url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            }),
            properties: { id: 'basemap' }
        })
    }
};
