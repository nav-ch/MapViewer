import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Globe, Server, Database, X, Check, Loader2, Layers, Search, Filter, MoreVertical, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { fetchLayers, createLayer, updateLayer, deleteLayer, cloneLayer, API_URL } from '../api';
import axios from 'axios';

const LAYER_TYPES = ['WMS', 'WFS', 'XYZ', 'ArcGIS_Rest', 'WMTS', 'OSM'];

const COMMON_PROJECTIONS = [
    { code: 'EPSG:3857', name: 'Web Mercator (Default)' },
    { code: 'EPSG:4326', name: 'WGS 84 (GPS)' },
    { code: 'EPSG:2056', name: 'CH1903+ / LV95' },
    { code: 'EPSG:21781', name: 'CH1903 / LV03' },
    { code: 'EPSG:2100', name: 'GGRS87 / Greek Grid' },
    { code: 'EPSG:25832', name: 'ETRS89 / UTM zone 32N' },
    { code: 'EPSG:3035', name: 'ETRS89 / LAEA Europe' },
    { code: 'EPSG:27700', name: 'OSGB 1936 / British National Grid' }
];

const LayerManagement = () => {
    const [layers, setLayers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLayer, setEditingLayer] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        type: 'WMS',
        url: '',
        params: {
            layers: '',
            identify_fields: '',
            legend_url: '',
            use_proxy: false
        },
        is_editable: false,
        projection: 'EPSG:3857'
    });
    const [loading, setLoading] = useState(false);
    const [discoveryFilter, setDiscoveryFilter] = useState('');
    const [discovering, setDiscovering] = useState(false);
    const [discoveredLayers, setDiscoveredLayers] = useState([]);

    const handleClone = async (id) => {
        try {
            await cloneLayer(id);
            loadLayers();
        } catch (err) {
            console.error('Clone failed:', err);
        }
    };

    // ... existing functions ...
    // Note: Inserting filter logic into the render part for discoveredLayers
    // I will replace the block rendering discoveredLayers to include the search input and filtering logic efficiently.
    const [discoveredProjections, setDiscoveredProjections] = useState([]);
    const [selectedDiscoveredLayer, setSelectedDiscoveredLayer] = useState('');

    useEffect(() => {
        loadLayers();
    }, []);

    const loadLayers = async () => {
        try {
            const res = await fetchLayers();
            setLayers(res.data);
        } catch (err) {
            console.error('Failed to load layers:', err);
        }
    };

    const handleOpenModal = (layer = null) => {
        console.log('handleOpenModal called with:', layer);
        if (layer) {
            let parsedParams = {};
            try {
                parsedParams = typeof layer.params === 'string' ? JSON.parse(layer.params) : (layer.params || {});
            } catch (e) {
                console.error('Error parsing layer params', e);
            }

            const sanitizedLayer = {
                ...layer,
                params: parsedParams,
                name: layer.name || '',
                type: layer.type || 'WMS',
                url: layer.url || '',
                is_editable: !!layer.is_editable,
                projection: layer.projection || 'EPSG:3857'
            };
            setEditingLayer(sanitizedLayer);
            setFormData(sanitizedLayer);
        } else {
            setEditingLayer(null);
            setFormData({
                name: '',
                type: 'WMS',
                url: '',
                params: { layers: '', identify_fields: '', legend_url: '', use_proxy: false },
                is_editable: false,
                projection: 'EPSG:3857'
            });
        }
        setDiscoveredLayers([]);
        setDiscoveredProjections([]);
        setSelectedDiscoveredLayer('');
        setDiscoveryFilter('');
        setDiscoveryFilter('');
        console.log('Setting isModalOpen to true');
        setIsModalOpen(true);
    };

    const discoverService = async () => {
        if (!formData.url) return alert('Please enter a URL first.');
        setDiscovering(true);
        try {
            // Use the proxy to avoid CORS
            const proxyBase = `${API_URL}/proxy`;
            const targetUrl = formData.url;

            if (formData.type === 'WMS') {
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(targetUrl)}&service=WMS&request=GetCapabilities`, { responseType: 'arraybuffer' });
                const data = res.data instanceof ArrayBuffer ? new TextDecoder().decode(res.data) : res.data;
                const parser = new DOMParser();
                const xml = parser.parseFromString(data, 'text/xml');

                // Extract projections
                const srsNodes = xml.querySelectorAll('SRS, CRS');
                const projections = Array.from(new Set(Array.from(srsNodes).map(n => n.textContent))).filter(p => p.startsWith('EPSG:'));
                setDiscoveredProjections(projections);

                const layerNodes = xml.querySelectorAll('Layer > Name');
                const found = Array.from(layerNodes).map(node => {
                    const layerNode = node.parentElement;
                    const legendNode = layerNode.querySelector('Style LegendURL OnlineResource');
                    return {
                        name: node.textContent,
                        title: layerNode.querySelector('Title')?.textContent || node.textContent,
                        legend_url: legendNode?.getAttribute('xlink:href') || ''
                    };
                }).filter(l => l.name);
                setDiscoveredLayers(found);

                if (projections.length > 0 && !formData.projection) {
                    setFormData(prev => ({ ...prev, projection: projections[0] }));
                }
            } else if (formData.type === 'ArcGIS_Rest') {
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(targetUrl)}&f=json`, { responseType: 'arraybuffer' });
                const data = res.data instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(res.data)) : res.data;

                if (data.spatialReference?.wkid) {
                    const wkid = `EPSG:${data.spatialReference.wkid}`;
                    setDiscoveredProjections([wkid]);
                    setFormData(prev => ({ ...prev, projection: wkid }));
                }

                if (data.layers) {
                    setDiscoveredLayers(data.layers.map(l => ({
                        name: String(l.id),
                        title: l.name,
                        fields: l.fields?.map(f => f.name).join(','),
                        legend_url: targetUrl.endsWith('/') ? `${targetUrl}legend` : `${targetUrl}/legend`
                    })));
                }
            } else if (formData.type === 'WFS') {
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(targetUrl)}&service=WFS&request=GetCapabilities`, { responseType: 'arraybuffer' });
                const data = res.data instanceof ArrayBuffer ? new TextDecoder().decode(res.data) : res.data;
                const parser = new DOMParser();
                const xml = parser.parseFromString(data, 'text/xml');

                // Extract projections
                const srsNodes = xml.querySelectorAll('DefaultSRS, OtherSRS, DefaultCRS, OtherCRS');
                const projections = Array.from(new Set(Array.from(srsNodes).map(n => n.textContent))).filter(p => p.startsWith('EPSG:'));
                setDiscoveredProjections(projections);

                const typeNodes = xml.querySelectorAll('FeatureType > Name');
                const found = Array.from(typeNodes).map(node => ({
                    name: node.textContent,
                    title: node.parentElement.querySelector('Title')?.textContent || node.textContent
                })).filter(l => l.name);
                setDiscoveredLayers(found);

                if (projections.length > 0 && !formData.projection) {
                    setFormData(prev => ({ ...prev, projection: projections[0] }));
                }
            }
        } catch (err) {
            console.error('Discovery failed:', err);
            const msg = err.response?.data?.details || err.message || 'Unknown error';
            alert(`Discovery failed: ${msg}. If this is a timeout, the service might be slow - try again.`);
        } finally {
            setDiscovering(false);
        }
    };

    const toggleDiscoveredLayer = async (layerName) => {
        const layer = discoveredLayers.find(l => l.name === layerName);
        if (!layer) return;

        const currentLayers = formData.params.layers ? formData.params.layers.split(',').filter(Boolean) : [];
        const isSelected = currentLayers.includes(layerName);

        let newLayers;
        if (isSelected) {
            newLayers = currentLayers.filter(l => l !== layerName);
        } else {
            newLayers = [...currentLayers, layerName];
        }

        let identifyFields = formData.params.identify_fields || '';

        // If adding a new layer, try to discover fields if none exist
        if (!isSelected && !identifyFields) {
            if (layer.fields) {
                identifyFields = layer.fields;
            } else if (formData.type === 'WFS') {
                try {
                    const proxyBase = `${API_URL}/proxy`;
                    const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(formData.url)}&service=WFS&request=DescribeFeatureType&typename=${layerName}&outputFormat=application/json`);
                    let data = res.data;
                    if (data instanceof ArrayBuffer) data = JSON.parse(new TextDecoder().decode(data));
                    if (data.featureTypes?.[0]?.properties) {
                        identifyFields = data.featureTypes[0].properties.map(p => p.name).join(',');
                    }
                } catch (e) { console.warn('Field discovery failed'); }
            }
        }

        const safeParams = typeof formData.params === 'object' && !Array.isArray(formData.params) ? formData.params : {};

        setFormData({
            ...formData,
            name: formData.name || layer.title,
            params: {
                ...safeParams,
                layers: newLayers.join(','),
                identify_fields: identifyFields,
                legend_url: layer.legend_url || safeParams.legend_url || ''
            }
        });
    };

    const reorderSubLayer = (index, direction) => {
        const currentLayers = formData.params.layers ? formData.params.layers.split(',').filter(Boolean) : [];
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === currentLayers.length - 1) return;

        const newLayers = [...currentLayers];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];

        const safeParams = typeof formData.params === 'object' && !Array.isArray(formData.params) ? formData.params : {};

        setFormData({
            ...formData,
            params: {
                ...safeParams,
                layers: newLayers.join(',')
            }
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingLayer) {
                await updateLayer(editingLayer.id, formData);
            } else {
                await createLayer(formData);
            }
            setIsModalOpen(false);
            loadLayers();
        } catch (err) {
            console.error('Save failed:', err);
            alert(`Failed to save layer: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this layer?')) return;
        try {
            await deleteLayer(id);
            loadLayers();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const filteredLayers = layers.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 lg:gap-8 min-h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">Layer Manager</h2>
                    <p className="text-slate-500 mt-1 font-medium">Configure and organize your geospatial data sources</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-100"
                >
                    <Plus size={20} /> Add New Layer
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search layers by name or type..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                    <Filter size={18} /> Filters
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredLayers.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-[32px]">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <Layers size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold text-lg">No layers found.</p>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search query.</p>
                    </div>
                )}
                {filteredLayers.map(layer => (
                    <div key={layer.id} className="glass-card p-6 flex flex-col justify-between group">
                        <div>
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <LayerIcon type={layer.type} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-1">{layer.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                                {layer.type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest pl-1">Data Source URL</label>
                                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap" title={layer.url}>
                                        {layer.url}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(layer); }}
                                    className="p-2.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(layer.id)}
                                    className="p-2.5 bg-slate-50 text-slate-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleClone(layer.id)}
                                    className="p-2.5 bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                    title="Clone Layer"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            {layer.is_editable && (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <Check size={14} className="font-bold" />
                                    <span className="text-xs font-bold uppercase">Editable</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in duration-300 flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{editingLayer ? 'Update Layer' : 'New Data Layer'}</h3>
                                <p className="text-sm text-slate-500 mt-1 font-medium">Define the geospatial service properties.</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Friendly Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium"
                                        placeholder="e.g. Vegetation Index"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Service Standard</label>
                                    <select
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 cursor-pointer appearance-none transition-all font-medium"
                                    >
                                        {LAYER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-bold text-slate-700 tracking-tight">Base Service URL</label>
                                    <button
                                        type="button"
                                        onClick={discoverService}
                                        disabled={discovering || !formData.url}
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 disabled:text-slate-400 flex items-center gap-1 transition-all"
                                    >
                                        {discovering ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
                                        {discovering ? 'Discovering...' : 'Discover Layers'}
                                    </button>
                                </div>
                                <input
                                    type="url"
                                    required
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium"
                                    placeholder={
                                        formData.type === 'WMS' ? 'https://demo.boundary.org/geoserver/wms' :
                                            formData.type === 'WFS' ? 'https://demo.boundary.org/geoserver/wfs' :
                                                formData.type === 'XYZ' ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' :
                                                    formData.type === 'ArcGIS_Rest' ? 'https://services.arcgis.com/.../MapServer' :
                                                        'https://...'
                                    }
                                />
                                <p className="text-[10px] text-slate-400 ml-2 font-medium">
                                    {formData.type === 'WMS' && 'Provide the base WMS endpoint without query params.'}
                                    {formData.type === 'WFS' && 'Provide the base WFS endpoint.'}
                                    {formData.type === 'XYZ' && 'Use {z}, {x}, {y} placeholders for tile coordinates.'}
                                    {formData.type === 'ArcGIS_Rest' && 'Provide the MapServer or FeatureServer root URL.'}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Spatial Reference (Projection)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={formData.projection}
                                        onChange={e => setFormData({ ...formData, projection: e.target.value })}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 cursor-pointer appearance-none transition-all font-medium"
                                    >
                                        <optgroup label="Discovered Projections">
                                            {discoveredProjections.length === 0 ? (
                                                <option disabled>No projections discovered yet</option>
                                            ) : (
                                                discoveredProjections.map(p => <option key={p} value={p}>{p}</option>)
                                            )}
                                        </optgroup>
                                        <optgroup label="Common Projections">
                                            {COMMON_PROJECTIONS.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                                        </optgroup>
                                    </select>
                                    <input
                                        type="text"
                                        value={formData.projection}
                                        onChange={e => setFormData({ ...formData, projection: e.target.value })}
                                        className="w-40 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 font-mono text-sm"
                                        placeholder="Manual EPSG..."
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 ml-2 font-medium italic">Standard projection for tiles/features. Re-discovery will update suggestions.</p>
                            </div>

                            {discoveredLayers.length > 0 && (
                                <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300 bg-blue-50/30 p-6 rounded-[24px] border border-blue-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-blue-800 tracking-tight">Available Sub-layers</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Filter..."
                                                className="bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 w-32"
                                                value={discoveryFilter}
                                                onChange={(e) => setDiscoveryFilter(e.target.value)}
                                            />
                                            <span className="text-[10px] font-bold text-blue-400 uppercase">{discoveredLayers.filter(l => l.title.toLowerCase().includes(discoveryFilter.toLowerCase())).length} Found</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {discoveredLayers
                                            .filter(l => l.title.toLowerCase().includes(discoveryFilter.toLowerCase()))
                                            .map(l => {
                                                const isSelected = formData.params.layers?.split(',').includes(l.name);
                                                return (
                                                    <button
                                                        key={l.name}
                                                        type="button"
                                                        onClick={() => toggleDiscoveredLayer(l.name)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isSelected ? 'bg-white text-blue-600 border-white' : 'border-slate-200'}`}>
                                                            {isSelected && <Check size={12} strokeWidth={4} />}
                                                        </div>
                                                        <span className="text-[11px] font-bold truncate flex-1">{l.title}</span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Layer Stack Order</label>
                                <div className="flex flex-col gap-2">
                                    {(!formData.params?.layers || formData.params.layers.split(',').filter(Boolean).length === 0) ? (
                                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center">
                                            <p className="text-xs text-slate-400 font-medium italic">No sub-layers selected. Use Discovery or enter manually.</p>
                                        </div>
                                    ) : (
                                        formData.params.layers.split(',').filter(Boolean).map((l, idx, arr) => (
                                            <div key={l} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">{idx + 1}</div>
                                                    <span className="text-sm font-bold text-slate-700">{l}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button type="button" onClick={() => reorderSubLayer(idx, 'up')} disabled={idx === 0} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20"><ArrowUp size={16} /></button>
                                                    <button type="button" onClick={() => reorderSubLayer(idx, 'down')} disabled={idx === arr.length - 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20"><ArrowDown size={16} /></button>
                                                    <button type="button" onClick={() => toggleDiscoveredLayer(l)} className="p-2 text-slate-400 hover:text-rose-600"><X size={16} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={formData.params?.layers || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        params: { ...formData.params, layers: e.target.value }
                                    })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium text-xs"
                                    placeholder="Manual overrides (comma separated)"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Identify Properties</label>
                                <input
                                    type="text"
                                    value={formData.params?.identify_fields || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        params: { ...formData.params, identify_fields: e.target.value }
                                    })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium"
                                    placeholder="e.g. name,capacity,status"
                                />
                                <p className="text-[10px] text-slate-400 ml-2 font-medium italic">Attribute names to display when a feature is clicked.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Legend URL (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.params?.legend_url || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        params: { ...formData.params, legend_url: e.target.value }
                                    })}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 transition-all font-medium"
                                    placeholder="e.g. https://.../wms?request=GetLegendGraphic..."
                                />
                                <p className="text-[10px] text-slate-400 ml-2 font-medium italic">Direct link to a legend image or GetLegendGraphic request.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.is_editable ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                        {formData.is_editable && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.is_editable}
                                        onChange={e => setFormData({ ...formData, is_editable: e.target.checked })}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 leading-none">Editable</p>
                                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium leading-tight text-balance">Allow WFS-T features.</p>
                                    </div>
                                </label>

                                <label className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.params?.use_proxy ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                        {formData.params?.use_proxy && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.params?.use_proxy || false}
                                        onChange={e => setFormData({
                                            ...formData,
                                            params: { ...formData.params, use_proxy: e.target.checked }
                                        })}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 leading-none">Use Proxy</p>
                                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium leading-tight text-balance">Bypass CORS restrictions.</p>
                                    </div>
                                </label>
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full sm:w-auto px-8 py-4 text-slate-500 hover:text-slate-800 font-bold text-sm transition-all"
                                >
                                    Discard Changes
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 hover:scale-[1.02] shadow-xl shadow-blue-100 transition-all disabled:opacity-50"
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    {editingLayer ? 'Update Layer Service' : 'Initialize Data Layer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const LayerIcon = ({ type }) => {
    switch (type) {
        case 'WMS': return <Server className="text-blue-600" />;
        case 'WFS': return <Database className="text-indigo-600" />;
        case 'ArcGIS_Rest': return <Globe className="text-emerald-600" />;
        case 'WMTS': return <Layers className="text-violet-600" />;
        case 'OSM': return <Globe className="text-amber-600" />;
        default: return <Database className="text-slate-600" />;
    }
};

export default LayerManagement;
