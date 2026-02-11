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

    return { select, modify, snap, saveChanges };
}
