import { layerRegistry } from './layer-registry';

/**
 * Factory function to create layers using the registry.
 * @param {Object} config - Layer configuration from backend/JSON.
 * @param {string} rootApiUrl - Root URL for proxying.
 * @returns {import('ol/layer/Base').default|null}
 */
export function createLayer(config, rootApiUrl) {
    if (!config || !config.type) return null;

    // Delegate to registry
    return layerRegistry.createLayer(config, { rootApiUrl });
}
