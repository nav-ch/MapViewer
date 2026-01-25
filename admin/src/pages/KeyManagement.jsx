import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Key as KeyIcon, Copy, Check, Loader2, ShieldCheck, ShieldAlert, X, Search, MoreVertical, ExternalLink, Globe } from 'lucide-react';
import { fetchApiKeys, createApiKey, deleteApiKey, updateApiKey, fetchMaps } from '../api';

const KeyManagement = () => {
    const [keys, setKeys] = useState([]);
    const [maps, setMaps] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [formData, setFormData] = useState({
        app_name: '',
        map_id: '',
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [keysRes, mapsRes] = await Promise.all([
                fetchApiKeys(),
                fetchMaps()
            ]);

            console.log('[KeyManagement] Data Loaded:', {
                keysCount: keysRes.data?.length,
                mapsCount: mapsRes.data?.length
            });

            if (keysRes.data && Array.isArray(keysRes.data)) {
                setKeys(keysRes.data);
            } else {
                console.error('[KeyManagement] Invalid keys data:', keysRes.data);
                setKeys([]);
            }

            if (mapsRes.data && Array.isArray(mapsRes.data)) {
                setMaps(mapsRes.data);
            } else {
                console.error('[KeyManagement] Invalid maps data:', mapsRes.data);
                setMaps([]);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        }
    };

    const handleOpenModal = (key = null) => {
        if (key) {
            setEditingKey(key);
            setFormData({
                app_name: key.app_name,
                map_id: key.map_id || '',
                is_active: key.is_active === 1 || key.is_active === true
            });
        } else {
            setEditingKey(null);
            setFormData({
                app_name: '',
                map_id: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingKey) {
                await updateApiKey(editingKey.id, formData);
            } else {
                await createApiKey(formData);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error('Operation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Revoke this API Key?')) return;
        try {
            await deleteApiKey(id);
            loadData();
        } catch (err) {
            console.error('Revoke failed:', err);
        }
    };

    const filteredKeys = keys.filter(k =>
        k.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 lg:gap-8 min-h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">Access Control</h2>
                    <p className="text-slate-500 mt-1 font-medium">Issue and govern security keys for external application embedding</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-100"
                >
                    <Plus size={20} /> Generate New Key
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Search keys by application name..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-sm font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="glass-card overflow-hidden shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-medium">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Application Identity</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Map Access</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Security Credential</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredKeys.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
                                                <KeyIcon size={24} />
                                            </div>
                                            <p className="text-slate-400 font-bold">No active credentials match your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filteredKeys.map(k => (
                                <tr key={k.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {k.app_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-slate-700">{k.app_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {k.map_id ? (
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                    <Globe size={12} />
                                                </div>
                                                <span className="text-sm font-bold truncate max-w-[150px]">{k.map_title || 'Linked Map'}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-300 italic text-sm">
                                                <span>Global Access</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <code className="bg-slate-100 px-3 py-1.5 rounded-lg text-blue-600 text-xs font-mono font-bold tracking-tight border border-slate-200">{k.key}</code>
                                            <button
                                                onClick={() => copyToClipboard(k.key, k.id)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm"
                                            >
                                                {copiedId === k.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {k.is_active ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                                <ShieldCheck size={14} className="font-bold" />
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Authorized</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                                                <ShieldAlert size={14} className="font-bold" />
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Revoked</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(k)}
                                                className="p-2.5 bg-white text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm border border-slate-100"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(k.id)}
                                                className="p-2.5 bg-white text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm border border-slate-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-600 p-8 lg:p-12 rounded-[32px] overflow-hidden relative shadow-2xl shadow-blue-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="max-w-xl">
                        <h3 className="text-2xl font-bold text-white mb-4 italic">Security Optimization_</h3>
                        <p className="text-blue-100 leading-relaxed font-medium">
                            Store these keys securely. Domain-restrict your keys whenever possible, and use <strong>Map Access</strong> limits to ensure applications only see data relevant to them.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{editingKey ? 'Configure Key' : 'Generate Key'}</h3>
                                <p className="text-sm text-slate-500 mt-1 font-medium">{editingKey ? 'Manage existing identity access.' : 'Issue a new security identity.'}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Application Identifier</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.app_name}
                                    onChange={e => setFormData({ ...formData, app_name: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium"
                                    placeholder="e.g. Sales Production Cluster"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Authorize for Specific Map</label>
                                <select
                                    value={formData.map_id}
                                    onChange={e => setFormData({ ...formData, map_id: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 cursor-pointer transition-all font-medium"
                                >
                                    <option value="">Full System Access (Global)</option>
                                    {maps.map(m => (
                                        <option key={m.id} value={m.id}>{m.title}</option>
                                    ))}
                                </select>
                            </div>

                            {editingKey && (
                                <label className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-200 transition-all">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.is_active ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                        {formData.is_active && <Check size={14} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 leading-none">Active Status</p>
                                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium leading-tight">Key will be {formData.is_active ? 'authorized to fetch maps' : 'rejected by the firewall'}.</p>
                                    </div>
                                </label>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 text-white w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading && <Loader2 size={18} className="animate-spin" />}
                                {editingKey ? 'Confirm Identity Update' : 'Generate Credential'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KeyManagement;
