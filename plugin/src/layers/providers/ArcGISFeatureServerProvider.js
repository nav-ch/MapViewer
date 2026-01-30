
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import EsriJSON from 'ol/format/EsriJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { createStringXY } from 'ol/coordinate';
import { Fill, Stroke, Circle as CircleStyle, Style, Text } from 'ol/style';

// Helper to convert simple JSON to OL Style Function
function getStyleFunction(styleConfig) {
    if (!styleConfig) return undefined; // Default OpenLayers style

    return function (feature, resolution) {
        const styles = [];

        // 1. Fill & Stroke (Polygon/Line)
        const fill = styleConfig.fill ? new Fill({ color: styleConfig.fill.color }) : undefined;
        const stroke = styleConfig.stroke ? new Stroke({
            color: styleConfig.stroke.color,
            width: styleConfig.stroke.width || 1.25,
            lineDash: styleConfig.stroke.lineDash
        }) : undefined;

        // 2. Point Handling (Circle)
        let image = undefined;
        if (styleConfig.radius || styleConfig.circle) {
            const radius = styleConfig.radius || styleConfig.circle?.radius || 5;
            const circleFill = styleConfig.circle?.fill ? new Fill(styleConfig.circle.fill) : (fill || new Fill({ color: 'rgba(255,0,0,0.5)' }));
            const circleStroke = styleConfig.circle?.stroke ? new Stroke(styleConfig.circle.stroke) : (stroke || new Stroke({ color: 'red', width: 1 }));

            image = new CircleStyle({
                radius: radius,
                fill: circleFill,
                stroke: circleStroke
            });
        }

        const baseStyle = new Style({
            fill: fill,
            stroke: stroke,
            image: image
        });

        // 3. Labels
        if (styleConfig.label && styleConfig.label.field) {
            const text = feature.get(styleConfig.label.field);
            if (text) {
                baseStyle.setText(new Text({
                    text: String(text),
                    font: styleConfig.label.font || '13px Calibri,sans-serif',
                    fill: new Fill({ color: styleConfig.label.color || '#000' }),
                    stroke: new Stroke({
                        color: styleConfig.label.haloColor || '#fff',
                        width: styleConfig.label.haloWidth || 3
                    }),
                    offsetY: -12
                }));
            }
        }

        styles.push(baseStyle);
        return styles;
    };
}

export const ArcGISFeatureServerProvider = {
    type: 'ARCGIS_FEATURE_SERVER',
    name: 'ArcGIS Feature Server',
    description: 'Esri ArcGIS Feature Service Layer (Vector)',

    create: (config, context) => {
        const { url, params, opacity, visible, projection } = config;
        const { rootApiUrl } = context || {};

        const isProxied = params?.use_proxy;
        // Ensure URL is clean (remove trailing slash)
        const serviceUrl = url.endsWith('/') ? url.slice(0, -1) : url;

        const esriJsonFormat = new EsriJSON();

        const vectorSource = new VectorSource({
            loader: function (extent, resolution, projection) {
                // Ensure we handle projection codes correctly.
                // 3857 (Web Mercator) is often used as 102100 in ArcGIS REST APIs, though 3857 is also supported on newer servers.
                let srsCode = projection.getCode().split(':')[1]; // e.g., 3857
                if (srsCode === '3857' || srsCode === '900913') {
                    srsCode = '102100';
                }

                const geometry = encodeURIComponent(
                    `{"xmin":${extent[0]},"ymin":${extent[1]},"xmax":${extent[2]},"ymax":${extent[3]},"spatialReference":{"wkid":${srsCode}}}`
                );

                // Ensure URL ends in a number (layer ID) before appending /query if not present?
                // Actually the prompt says: "I still cannot see the all trails featureserver layer"
                // The URL logic in UI sets url to `.../FeatureServer/0`.
                // Here we construct: `${serviceUrl}/query/...`
                // If serviceUrl is `.../FeatureServer`, then `.../FeatureServer/query` is invalid for fetching features from a layer. It must be `.../FeatureServer/0/query`.
                // We should detect if the user provided a root FeatureServer URL but forgot the layer ID, and maybe default to 0? 
                // Or better, log a warning. The 'toggleDiscoveredLayer' logic in UI should have handled this, but let's be robust.

                let queryBase = serviceUrl;
                if (!/\/\d+$/.test(serviceUrl)) {
                    // Try to guess layer 0 if no layer ID is present
                    console.warn(`URL ${serviceUrl} does not look like a specific layer (does not end in /ID). Appending /0.`);
                    queryBase = `${serviceUrl}/0`;
                }

                const queryUrl = `${queryBase}/query/?f=json&returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=${geometry}&geometryType=esriGeometryEnvelope&inSR=${srsCode}&outFields=*&outSR=${srsCode}`;

                console.debug('[ArcGIS Feature Server] Loading:', queryUrl);

                const fetchUrl = isProxied && rootApiUrl
                    ? `${rootApiUrl}/api/proxy?url=${encodeURIComponent(queryUrl)}`
                    : queryUrl;

                fetch(fetchUrl)
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            console.error('[ArcGIS Feature Server] JSON Error:', data.error);
                            return;
                        }
                        // ArcGIS errors sometimes come as 200 OK but with "error" field.

                        const features = esriJsonFormat.readFeatures(data, {
                            featureProjection: projection
                        });
                        console.debug(`[ArcGIS Feature Server] Loaded ${features.length} features.`);

                        if (features.length > 0) {
                            this.addFeatures(features);
                        }
                    })
                    .catch(e => {
                        console.error('[ArcGIS Feature Server] Fetch Error:', e);
                        // If cross-origin error, might need proxy
                        if (e.message && e.message.includes('Failed to fetch')) {
                            console.warn('Network error. Check CORS or try enabling Proxy.');
                        }
                    });
            },
            strategy: bboxStrategy,
            attributions: 'Esri ArcGIS'
        });

        // Parse Style Config
        let layerStyle = undefined;
        if (params?.style) {
            try {
                const styleConfig = typeof params.style === 'string' ? JSON.parse(params.style) : params.style;
                layerStyle = getStyleFunction(styleConfig);
            } catch (e) {
                console.warn('Invalid Style JSON for ArcGIS Layer', e);
            }
        }

        return new VectorLayer({
            source: vectorSource,
            opacity: opacity ?? 1,
            visible: visible ?? true,
            style: layerStyle // Apply the custom style function
        });
    }
};
