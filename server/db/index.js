const { loadConfig } = require('../config/database');
const SQLiteProvider = require('./providers/SQLiteProvider');
const PostgresProvider = require('./providers/PostgresProvider');

let provider = null;

function getProvider() {
    if (provider) return provider;

    const config = loadConfig();
    console.log(`Initializing database provider: ${config.type}`);

    switch (config.type) {
        case 'postgres':
            provider = new PostgresProvider(config);
            break;
        case 'sqlite':
        default:
            provider = new SQLiteProvider(config);
            break;
    }

    return provider;
}

// Initialize provider on load
getProvider();

module.exports = {
    query: async (text, params) => {
        return await provider.query(text, params);
    },
    getProvider, // Exported to allow switching providers or accessing provider-specific methods
    close: async () => {
        if (provider) {
            await provider.close();
            provider = null;
        }
    }
};

