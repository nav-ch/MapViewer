import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import TileArcGISRest from 'ol/source/TileArcGISRest';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';

export function createLayer(config, rootApiUrl) {
    const { type, url, params, opacity, visible, projection } = config;
    const isProxied = params?.use_proxy;
    const finalUrl = isProxied && rootApiUrl ? `${rootApiUrl}/api/proxy?url=${encodeURIComponent(url)}` : url;
    const layerProj = projection || 'EPSG:3857';

    switch (type.toUpperCase()) {
        case 'OSM':
            return new TileLayer({
                source: new OSM(),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });

        case 'WMS':
            return new TileLayer({
                source: new TileWMS({
                    url: finalUrl,
                    params: {
                        ...(typeof params === 'object' ? params : {}),
                        'LAYERS': params?.layers || '',
                        'TILED': true,
                        'TRANSPARENT': true
                    },
                    serverType: 'geoserver',
                    transition: 0,
                    projection: layerProj
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });

        case 'XYZ':
            return new TileLayer({
                source: new XYZ({
                    url: finalUrl,
                    projection: layerProj
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });

        case 'WFS':
            return new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: function (extent) {
                        const baseUrl = finalUrl + (isProxied ? '&' : '?');
                        return (
                            baseUrl +
                            'service=WFS&' +
                            'version=1.1.0&request=GetFeature&typename=' + (params.layers || params.typeName) +
                            '&outputFormat=application/json&srsname=' + layerProj + '&' +
                            'bbox=' + extent.join(',') + ',' + layerProj
                        );
                    },
                    strategy: bboxStrategy,
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });

        case 'ARCGIS_REST':
            return new TileLayer({
                source: new TileArcGISRest({
                    url: finalUrl,
                    params: {
                        ...(typeof params === 'object' ? params : {}),
                        'LAYERS': params?.layers ? `show:${params.layers}` : undefined
                    },
                    projection: layerProj
                }),
                opacity: opacity ?? 1,
                visible: visible ?? true
            });

        default:
            console.warn(`Layer type ${type} not fully implemented in this version.`);
            return null;
    }
}
