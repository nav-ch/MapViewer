import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Globe, Server, Database, X, Check, Loader2, Search, Settings, RefreshCw } from 'lucide-react';
import { fetchBasemaps, createBasemap, updateBasemap, deleteBasemap, API_URL } from '../api';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import { optionsFromCapabilities } from 'ol/source/WMTS';

const BASEMAP_TYPES = ['XYZ', 'WMS', 'WMTS', 'ArcGIS_Rest', 'OSM'];

const BasemapManagement = () => {
    const [basemaps, setBasemaps] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBasemap, setEditingBasemap] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        type: 'XYZ',
        url: '',
        params: {}
    });
    const [loading, setLoading] = useState(false);
    const [wmtsLayers, setWmtsLayers] = useState([]);
    const [wmtsParsedResult, setWmtsParsedResult] = useState(null);
    const [loadingCapabilities, setLoadingCapabilities] = useState(false);

    useEffect(() => {
        loadBasemaps();
    }, []);

    const loadBasemaps = async () => {
        setLoading(true);
        try {
            const res = await fetchBasemaps();
            setBasemaps(res.data);
        } catch (err) {
            console.error('Failed to load basemaps:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (basemap = null) => {
        setWmtsLayers([]);
        if (basemap) {
            setEditingBasemap(basemap);
            setFormData({
                ...basemap,
                params: typeof basemap.params === 'string' ? JSON.parse(basemap.params) : (basemap.params || {})
            });
        } else {
            setEditingBasemap(null);
            setFormData({
                name: '',
                type: 'XYZ',
                url: '',
                params: {}
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingBasemap) {
                await updateBasemap(editingBasemap.id, formData);
            } else {
                await createBasemap(formData);
            }
            setIsModalOpen(false);
            loadBasemaps();
        } catch (err) {
            alert('Failed to save basemap: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this basemap?')) return;
        try {
            await deleteBasemap(id);
            loadBasemaps();
        } catch (err) {
            alert('Failed to delete basemap: ' + err.message);
        }
    };

    const fetchWmtsCapabilities = async () => {
        if (!formData.url) return;
        setLoadingCapabilities(true);
        try {
            // Use proxy to avoid CORS
            const proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(formData.url)}`;
            const response = await fetch(proxyUrl);
            const text = await response.text();

            const parser = new WMTSCapabilities();
            const result = parser.read(text);

            if (result && result.Contents && result.Contents.Layer) {
                setWmtsParsedResult(result);
                setWmtsLayers(result.Contents.Layer);
                // Auto-select first if not set
                // const firstLayer = result.Contents.Layer[0];
                // if (firstLayer) selectWmtsLayer(firstLayer);
            } else {
                alert('No layers found in WMTS Capabilities');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to fetch capabilities: ' + error.message);
        } finally {
            setLoadingCapabilities(false);
        }
    };

    const selectWmtsLayer = (layer) => {
        // Find best MatrixSet (EPSG:3857 or GoogleMapsCompatible)
        const preferredSets = ['EPSG:3857', 'GoogleMapsCompatible', 'PM', '3857'];
        let selectedMatrixSet = layer.TileMatrixSetLink?.[0]?.TileMatrixSet;

        // Try to find a preferred one
        if (layer.TileMatrixSetLink) {
            const found = layer.TileMatrixSetLink.find(link =>
                preferredSets.some(pref => link.TileMatrixSet?.includes(pref))
            );
            if (found) selectedMatrixSet = found.TileMatrixSet;
        }

        let extractedParams = {};

        // Use optionsFromCapabilities to get exact config
        if (wmtsParsedResult) {
            try {
                const options = optionsFromCapabilities(wmtsParsedResult, {
                    layer: layer.Identifier,
                    matrixSet: selectedMatrixSet
                });

                if (options) {
                    // Extract TileGrid info to simple JSON arrays
                    const tileGrid = options.tileGrid;
                    if (tileGrid) {
                        extractedParams.matrixIds = tileGrid.getMatrixIds();
                        extractedParams.resolutions = tileGrid.getResolutions();
                        // Origin might be needed too, but let's assume standard top-left or try to extract
                        // tileGrid.getOrigin() returns coordinate.
                        extractedParams.origin = tileGrid.getOrigin(0); // usually 0
                    }

                    // Also URL might be different (RESTful)
                    if (options.urls && options.urls.length > 0) {
                        // We prefer to keep the base URL, but let's see.
                        // Actually, let's keep the user provided URL as the "Base" or update it?
                        // If we update it, we might break subsequent edits.
                        // For now, let's just save the params.
                    }
                }
            } catch (e) {
                console.error("Error extracting options:", e);
            }
        }

        const newParams = {
            layer: layer.Identifier,
            style: layer.Style?.[0]?.Identifier || 'default',
            matrixSet: selectedMatrixSet,
            format: layer.Format?.[0] || 'image/png',
            ...extractedParams
        };

        setFormData(prev => ({
            ...prev,
            name: prev.name || layer.Title || layer.Identifier,
            params: newParams
        }));
    };

    const filteredBasemaps = basemaps.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Global Basemaps</h2>
                    <p className="text-slate-500 text-sm mt-1">Configure basemaps available for all maps</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                    <Plus size={20} /> Add Basemap
                </button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search basemaps..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Basemap Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBasemaps.map(basemap => (
                    <div key={basemap.id} className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button
                                onClick={() => handleOpenModal(basemap)}
                                className="p-2 bg-white text-slate-600 hover:text-blue-600 rounded-lg shadow-sm border border-slate-100"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(basemap.id)}
                                className="p-2 bg-white text-slate-600 hover:text-red-600 rounded-lg shadow-sm border border-slate-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Globe size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{basemap.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase tracking-wider">
                                        {basemap.type}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                                    {basemap.url}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {editingBasemap ? 'Edit Basemap' : 'Add New Basemap'}
                                </h3>
                                <p className="text-sm text-slate-500">Configure global map provider</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                                <input
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Source Type</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium cursor-pointer"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        {BASEMAP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Service URL</label>
                                <div className="flex gap-2">
                                    <textarea
                                        required
                                        rows={2}
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-sm"
                                        placeholder="e.g. https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        value={formData.url}
                                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    />
                                    {formData.type === 'WMTS' && (
                                        <button
                                            type="button"
                                            onClick={fetchWmtsCapabilities}
                                            disabled={loadingCapabilities || !formData.url}
                                            className="px-4 bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1 min-w-[80px]"
                                        >
                                            {loadingCapabilities ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                                            <span className="text-[10px]">Fetch</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* WMTS Layer Selection */}
                            {formData.type === 'WMTS' && wmtsLayers.length > 0 && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Select Layer</label>
                                    <select
                                        className="w-full px-4 py-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl outline-none font-medium cursor-pointer"
                                        onChange={(e) => {
                                            const layer = wmtsLayers.find(l => l.Identifier === e.target.value);
                                            if (layer) selectWmtsLayer(layer);
                                        }}
                                        value={formData.params?.layer || ''}
                                    >
                                        <option value="">-- Choose a Layer --</option>
                                        {wmtsLayers.map(l => (
                                            <option key={l.Identifier} value={l.Identifier}>
                                                {l.Title || l.Identifier}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Params JSON Editor */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Parameters (JSON)</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-xs"
                                    rows={4}
                                    value={JSON.stringify(formData.params, null, 2)}
                                    onChange={e => {
                                        try {
                                            setFormData({ ...formData, params: JSON.parse(e.target.value) });
                                        } catch (e) {
                                            // Handle invalid JSON typing
                                        }
                                    }}
                                />
                                <p className="text-[10px] text-slate-400 px-1">
                                    For WMTS: {`{"layer": "...", "style": "...", "matrixSet": "...", "format": "..."}`}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                    {editingBasemap ? 'Update Basemap' : 'Save Basemap'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BasemapManagement;
