import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

/**
 * Parses a simplified JSON style object into an OpenLayers Style.
 * 
 * Expected JSON Format:
 * {
 *   "fill": { "color": "rgba(255, 0, 0, 0.5)" },
 *   "stroke": { "color": "#000000", "width": 2 },
 *   "radius": 5, // For points
 *   "label": { "field": "name", "font": "12px sans-serif", "color": "#000" } // Optional label
 * }
 * 
 * @param {Object} styleConfig - Simplified style configuration.
 * @returns {import('ol/style/Style').default} OpenLayers Style object.
 */
export function parseStyle(styleConfig) {
    if (!styleConfig) return null; // Fallback to default OL style

    // Parse Fill
    const fill = styleConfig.fill ? new Fill({
        color: styleConfig.fill.color || 'rgba(255, 255, 255, 0.4)'
    }) : undefined;

    // Parse Stroke
    const stroke = styleConfig.stroke ? new Stroke({
        color: styleConfig.stroke.color || '#3399CC',
        width: styleConfig.stroke.width || 1.25,
        lineDash: styleConfig.stroke.lineDash || undefined
    }) : undefined;

    // Parse Image (Circle for Points)
    // If radius is present, we assume point styling
    let image = undefined;
    if (styleConfig.radius !== undefined || styleConfig.circle) {
        const radius = styleConfig.radius || styleConfig.circle?.radius || 5;
        const circleFill = styleConfig.circle?.fill ? new Fill({ color: styleConfig.circle.fill.color }) : fill;
        const circleStroke = styleConfig.circle?.stroke ? new Stroke(styleConfig.circle.stroke) : stroke;

        image = new CircleStyle({
            radius: radius,
            fill: circleFill,
            stroke: circleStroke
        });
    }

    // Parse Text Label
    let text = undefined;
    if (styleConfig.label) {
        text = new Text({
            font: styleConfig.label.font || '13px Calibri,sans-serif',
            fill: new Fill({ color: styleConfig.label.color || '#000' }),
            stroke: new Stroke({
                color: styleConfig.label.haloColor || '#fff',
                width: styleConfig.label.haloWidth || 3
            }),
            // Label text is dynamic; usually handled by a style function. 
            // Here we return the base Text style, but the provider needs to wrap this in a function if 'field' is used.
            text: styleConfig.label.text || undefined
        });
    }

    return new Style({
        image: image,
        fill: fill, // For polygons
        stroke: stroke, // For lines/polygons
        text: text
    });
}

/**
 * Creates a style function if the config relies on feature properties (e.g. labels).
 * @param {Object} styleConfig 
 * @returns {Function} Style function
 */
export function createStyleFunction(styleConfig) {
    const baseStyle = parseStyle(styleConfig);

    // If no dynamic labelling, return the static style
    if (!styleConfig?.label?.field) {
        return baseStyle;
    }

    // Return a function that updates the text based on the feature
    return function (feature) {
        const labelText = feature.get(styleConfig.label.field);
        if (baseStyle.getText()) {
            baseStyle.getText().setText(labelText ? String(labelText) : '');
        }
        return baseStyle;
    };

}
