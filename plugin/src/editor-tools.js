import { Select, Modify, Draw, Snap } from 'ol/interaction';
import { WFS } from 'ol/format';

export function setupEditing(map, layer, type) {
    if (type !== 'WFS') return null;

    const select = new Select();
    const modify = new Modify({
        features: select.getFeatures(),
    });

    map.addInteraction(select);
    map.addInteraction(modify);

    const snap = new Snap({ source: layer.getSource() });
    map.addInteraction(snap);

    // Save logic
    const saveChanges = async () => {
        const formatWFS = new WFS();
        const features = layer.getSource().getFeatures();

        // This is a simplified WFS-T save logic
        // In a real app, we would track which features were modified
        const node = formatWFS.writeTransaction(null, features, null, {
            featureNS: 'http://www.opengis.net/wfs',
            featurePrefix: 'feature',
            featureType: 'your_layer_name',
            srsName: 'EPSG:3857',
        });

        const xmlSerializer = new XMLSerializer();
        const payload = xmlSerializer.serializeToString(node);

        try {
            await fetch(layer.getSource().getUrl(), {
                method: 'POST',
                body: payload,
                headers: { 'Content-Type': 'text/xml' }
            });
            console.log('Changes saved successfully');
        } catch (err) {
            console.error('Failed to save changes:', err);
        }
    };

    return { select, modify, snap, saveChanges };
}
