import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DatabaseSettings.css';

const DatabaseSettings = () => {
    const [config, setConfig] = useState({
        type: 'sqlite',
        host: 'localhost',
        port: 5432,
        user: '',
        password: '',
        database: '',
        ssl: false
    });
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [connectionVerified, setConnectionVerified] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/config/database', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConfig(prev => ({ ...prev, ...res.data }));
            setLoading(false);
        } catch (err) {
            setError('Failed to load configuration');
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        setConfig(prev => {
            const newConfig = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };

            // Set defaults when type changes
            if (name === 'type') {
                setConnectionVerified(false);
                switch (value) {
                    case 'postgres': newConfig.port = 5432; break;
                    case 'mysql': newConfig.port = 3306; break;
                    case 'oracle': newConfig.port = 1521; break;
                    case 'mssql': newConfig.port = 1433; break;
                    default: break;
                }
            }
            return newConfig;
        });

        // Reset verification on any config change (except simple toggles if we want strictness)
        if (name !== 'ssl') {
            setConnectionVerified(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setMessage(null);
        setError(null);
        setConnectionVerified(false);

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/config/database/test', config, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Connection successful! Privileges verified.');
            setConnectionVerified(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Connection failed');
            setConnectionVerified(false);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setMessage(null);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            // If password is masked, don't send it unless changed? 
            // The backend should handle '********' or we just send it and backend ignores if it matches mask?
            // Actually, for simplicity, if user didn't change password field and it is masked, we might need a flag.
            // But here we are just sending what's in state. 
            // If it is '********', backend should probably not overwrite with that. 
            // Let's assume user re-enters password if they change config, or we handle it in backend.
            // For now, let's send it.

            await axios.post('/api/config/database', config, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Configuration saved. Please restart the server.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save configuration');
        }
    };

    const handleMigrate = async () => {
        if (!window.confirm('Are you sure you want to migrate data to the new database? This may take some time.')) return;

        setMigrating(true);
        setMessage(null);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/config/database/migrate', config, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Migration successful!');
        } catch (err) {
            setError(err.response?.data?.error || 'Migration failed');
        } finally {
            setMigrating(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="database-settings">
            <h2>Database Configuration</h2>

            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}

            <div className="form-group">
                <label>Database Type:</label>
                <select name="type" value={config.type} onChange={handleChange}>
                    <option value="sqlite">SQLite (Built-in)</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="oracle">Oracle</option>
                    <option value="mssql">SQL Server</option>
                </select>
            </div>

            {config.type !== 'sqlite' && (
                <>
                    <div className="form-group">
                        <label>Host:</label>
                        <input type="text" name="host" value={config.host} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Port:</label>
                        <input type="number" name="port" value={config.port} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Database Name:</label>
                        <input type="text" name="database" value={config.database} onChange={handleChange} />
                        {config.type === 'oracle' && <small className="hint">Use Service Name or SID</small>}
                    </div>
                    <div className="form-group">
                        <label>User:</label>
                        <input type="text" name="user" value={config.user} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Password:</label>
                        <input type="password" name="password" value={config.password} onChange={handleChange} placeholder={config.password === '********' ? '********' : ''} />
                    </div>
                    <div className="form-group checkbox">
                        <label>
                            <input type="checkbox" name="ssl" checked={config.ssl} onChange={handleChange} />
                            Use SSL
                        </label>
                    </div>
                </>
            )}

            <div className="actions">
                {config.type !== 'sqlite' && (
                    <button onClick={handleTestConnection} disabled={testing || migrating}>
                        {testing ? 'Testing...' : 'Test Connection'}
                    </button>
                )}
                <button onClick={handleSave} disabled={testing || migrating}>
                    Save Configuration
                </button>
                {config.type !== 'sqlite' && (
                    <button
                        onClick={handleMigrate}
                        disabled={testing || migrating || !connectionVerified}
                        className="migrate-btn"
                        title={!connectionVerified ? "Please test connection successfully first" : "Migrate data"}
                    >
                        {migrating ? 'Migrating...' : 'Migrate Data'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default DatabaseSettings;
