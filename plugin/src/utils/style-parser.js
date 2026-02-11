import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

/**
 * Parses a JSON style configuration into an OpenLayers Style object.
 * @param {Object} styleConfig - The style configuration object.
 * @returns {Style} The OpenLayers Style object.
 */
export function parseStyle(styleConfig) {
    if (!styleConfig) return undefined; // Default OpenLayers style

    // Handle stringified JSON from backend
    let config = styleConfig;
    if (typeof styleConfig === 'string') {
        try {
            config = JSON.parse(styleConfig);
        } catch (e) {
            console.warn('Invalid JSON style string:', styleConfig);
            return undefined;
        }
    }

    // If empty object, return undefined
    if (Object.keys(config).length === 0) return undefined;

    const styleOpts = {};
    let hasStyle = false;

    // Fill
    const fillColor = config.fillColor || (config.fill && config.fill.color);
    if (fillColor) {
        styleOpts.fill = new Fill({
            color: fillColor
        });
        hasStyle = true;
    }

    // Stroke
    const strokeColor = config.strokeColor || (config.stroke && config.stroke.color);
    const strokeWidth = config.strokeWidth || (config.stroke && config.stroke.width);
    const lineDash = config.lineDash || (config.stroke && config.stroke.lineDash);

    if (strokeColor || strokeWidth) {
        styleOpts.stroke = new Stroke({
            color: strokeColor || '#000000',
            width: strokeWidth || 1,
            lineDash: lineDash || undefined
        });
        hasStyle = true;
    }

    // Point / Circle
    // Check key "pointRadius" OR "circle" object
    const circleConfig = config.circle;
    const pointRadius = config.pointRadius || (circleConfig && circleConfig.radius);

    if (pointRadius) {
        const circleFillColor = (circleConfig && circleConfig.fill && circleConfig.fill.color) || config.fillColor || '#ff0000';
        const circleStrokeColor = (circleConfig && circleConfig.stroke && circleConfig.stroke.color) || config.strokeColor || '#000000';
        const circleStrokeWidth = (circleConfig && circleConfig.stroke && circleConfig.stroke.width) || config.strokeWidth || 1;

        styleOpts.image = new CircleStyle({
            radius: pointRadius,
            fill: new Fill({
                color: circleFillColor
            }),
            stroke: new Stroke({
                color: circleStrokeColor,
                width: circleStrokeWidth
            })
        });
        hasStyle = true;
    }

    // If we parsed successfully but found no valid style properties, return undefined 
    // to fall back to OL default (instead of invisible features)
    if (!hasStyle) return undefined;

    return new Style(styleOpts);
}
