
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

/**
 * Parses a simplified JSON style object into an OpenLayers Style.
 */
export function parseStyle(styleConfig) {
    if (!styleConfig) return undefined; // Return undefined to use default OL style if no config

    const styles = [];

    // 1. Fill (Polygons)
    if (styleConfig.fill) {
        styles.push(new Style({
            fill: new Fill({
                color: styleConfig.fill.color || 'rgba(255, 255, 255, 0.4)'
            })
        }));
    }

    // 2. Stroke (Lines/Polygons)
    if (styleConfig.stroke) {
        styles.push(new Style({
            stroke: new Stroke({
                color: styleConfig.stroke.color || '#3399CC',
                width: styleConfig.stroke.width || 1.25,
                lineDash: styleConfig.stroke.lineDash || undefined
            })
        }));
    }

    // 3. Circle (Points)
    if (styleConfig.circle || styleConfig.radius) {
        const radius = styleConfig.circle?.radius || styleConfig.radius || 5;
        const fill = styleConfig.circle?.fill ? new Fill({ color: styleConfig.circle.fill.color }) :
            (styleConfig.fill ? new Fill({ color: styleConfig.fill.color }) : new Fill({ color: '#3399CC' }));
        const stroke = styleConfig.circle?.stroke ? new Stroke(styleConfig.circle.stroke) :
            (styleConfig.stroke ? new Stroke(styleConfig.stroke) : new Stroke({ color: '#fff', width: 1 }));

        styles.push(new Style({
            image: new CircleStyle({
                radius: radius,
                fill: fill,
                stroke: stroke
            })
        }));
    }

    // 4. Text Label
    if (styleConfig.label) {
        // If it's a static text label (unlikely, usually field-based)
        if (styleConfig.label.text) {
            styles.push(new Style({
                text: new Text({
                    text: styleConfig.label.text,
                    font: styleConfig.label.font || '12px sans-serif',
                    fill: new Fill({ color: styleConfig.label.color || '#000' }),
                    stroke: new Stroke({
                        color: styleConfig.label.haloColor || '#fff',
                        width: styleConfig.label.haloWidth || 3
                    })
                })
            }));
        }
    }

    // If no specific style parts found but config exists, maybe return a default? 
    // For now returning whatever we found.
    // If styles array is empty, OL will use default. 
    // BUT we want to combine them into one Style object if possible or return array.
    // OL accepts array or single style.

    // Combining for simplicity where possible, but returning array is safer.
    if (styles.length === 0 && (styleConfig.fill || styleConfig.stroke)) {
        // Fallback for simple structure like {fill:{...}, stroke:{...}}
        return new Style({
            fill: styleConfig.fill ? new Fill(styleConfig.fill) : undefined,
            stroke: styleConfig.stroke ? new Stroke(styleConfig.stroke) : undefined
        });
    }

    return styles.length > 0 ? styles : undefined;
}

/**
 * Creates a style function for dynamic properties (like labels).
 */
export function createStyleFunction(styleConfig) {
    if (!styleConfig) return undefined;

    // Helper to get base style
    const getBaseStyle = () => {
        const fill = styleConfig.fill ? new Fill({ color: styleConfig.fill.color }) : undefined;
        const stroke = styleConfig.stroke ? new Stroke({ color: styleConfig.stroke.color, width: styleConfig.stroke.width }) : undefined;
        let image = undefined;

        if (styleConfig.circle || styleConfig.radius) {
            const radius = styleConfig.circle?.radius || styleConfig.radius || 5;
            const cFill = styleConfig.circle?.fill ? new Fill(styleConfig.circle.fill) : (fill || new Fill({ color: 'red' }));
            const cStroke = styleConfig.circle?.stroke ? new Stroke(styleConfig.circle.stroke) : new Stroke({ color: 'white', width: 1 });
            image = new CircleStyle({
                radius: radius,
                fill: cFill,
                stroke: cStroke
            });
        }

        return new Style({ fill, stroke, image });
    };

    return (feature, resolution) => {
        const style = getBaseStyle();

        if (styleConfig.label && styleConfig.label.field) {
            const labelValue = feature.get(styleConfig.label.field);
            if (labelValue) {
                style.setText(new Text({
                    text: String(labelValue),
                    font: styleConfig.label.font || '13px Calibri,sans-serif',
                    fill: new Fill({ color: styleConfig.label.color || '#000' }),
                    stroke: new Stroke({
                        color: styleConfig.label.haloColor || '#fff',
                        width: styleConfig.label.haloWidth || 3
                    }),
                    offsetY: -10
                }));
            }
        }
        return style;
    };
}
