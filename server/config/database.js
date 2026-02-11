const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'database.json');

// Ensure config dir exists
const configDir = path.dirname(CONFIG_PATH);
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

function loadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error reading database config:', err);
        }
    }
    // Default to SQLite
    return {
        type: 'sqlite',
        connectionString: path.join(__dirname, '..', '..', 'database.sqlite')
    };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing database config:', err);
        throw err;
    }
}

module.exports = {
    loadConfig,
    saveConfig
};
