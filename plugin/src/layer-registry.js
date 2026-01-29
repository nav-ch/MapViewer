/**
 * Singleton registry for managing layer providers.
 */
class LayerRegistry {
    constructor() {
        this.providers = new Map();
    }

    /**
     * Register a new layer provider.
     * @param {Object} provider - The provider object implementing the standard interface.
     */
    register(provider) {
        if (!provider.type) {
            console.error('LayerRegistry: Provider missing "type" property', provider);
            return;
        }
        console.log(`[LayerRegistry] Registering provider: ${provider.type}`);
        this.providers.set(provider.type.toUpperCase(), provider);
    }

    /**
     * Get a registered provider by type.
     * @param {string} type 
     * @returns {Object|undefined}
     */
    get(type) {
        return this.providers.get(type?.toUpperCase());
    }

    /**
     * Get all registered providers.
     * @returns {Array}
     */
    getAll() {
        return Array.from(this.providers.values());
    }

    /**
     * Create an OpenLayers layer using the appropriate provider.
     * @param {Object} config - Layer configuration object.
     * @param {Object} context - Context containing rootApiUrl, etc.
     * @returns {import('ol/layer/Base').default|null}
     */
    createLayer(config, context) {
        const { type } = config;
        const provider = this.get(type);

        if (!provider) {
            console.warn(`[LayerRegistry] No provider found for layer type: ${type}`);
            return null;
        }

        try {
            return provider.create(config, context);
        } catch (err) {
            console.error(`[LayerRegistry] Error creating layer of type ${type}:`, err);
            return null;
        }
    }
}

// Export a singleton instance
export const layerRegistry = new LayerRegistry();
