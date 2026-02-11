import { Select, Modify, Draw, Snap } from 'ol/interaction';
import { WFS, GeoJSON } from 'ol/format';

export function setupEditing(map, layer, type) {
    // Allow WFS and generic Vector
    if (type !== 'WFS' && type !== 'Vector') return null;

    const select = new Select();
    const modify = new Modify({
        features: select.getFeatures(),
    });

    map.addInteraction(select);
    map.addInteraction(modify);

    const snap = new Snap({ source: layer.getSource() });
    map.addInteraction(snap);

    let saveChanges = null;

    if (type === 'WFS') {
        saveChanges = async () => {
            const formatWFS = new WFS();
            const features = layer.getSource().getFeatures();
            const wfsUrl = layer.get('wfsUrl');
            const wfsParams = layer.get('wfsParams') || {};
            const rootApiUrl = layer.get('rootApiUrl');

            const featureType = wfsParams.layers || wfsParams.typeName || 'feature';

            const node = formatWFS.writeTransaction(null, features, null, {
                featureNS: 'http://www.opengis.net/wfs',
                featurePrefix: 'feature',
                featureType: featureType,
                srsName: 'EPSG:3857',
            });

            const xmlSerializer = new XMLSerializer();
            const payload = xmlSerializer.serializeToString(node);

            let fetchUrl = wfsUrl;

            if (wfsParams.use_proxy && rootApiUrl) {
                fetchUrl = `${rootApiUrl}/api/proxy?url=${encodeURIComponent(wfsUrl)}`;
            }

            try {
                const response = await fetch(fetchUrl, {
                    method: 'POST',
                    body: payload,
                    headers: { 'Content-Type': 'text/xml' }
                });

                if (response.ok) {
                    console.log('Changes saved successfully');
                    alert('Changes saved!');
                } else {
                    console.error('Save failed', response.statusText);
                    alert('Save failed: ' + response.statusText);
                }
            } catch (err) {
                console.error('Failed to save changes:', err);
                alert('Error saving changes');
            }
        };
    } else {
        // For Vector, saveChanges might just trigger an event or return data
        saveChanges = async () => {
            console.log('Client-side save triggered for Vector layer');
            // Dispatch event to parent?
            const event = new CustomEvent('layer-saved', {
                detail: {
                    layerName: layer.get('name'),
                    features: new GeoJSON().writeFeaturesObject(layer.getSource().getFeatures())
                },
                bubbles: true,
                composed: true
            });
            map.getTargetElement().dispatchEvent(event);
        };
    }

    return { select, modify, snap, saveChanges };
}
