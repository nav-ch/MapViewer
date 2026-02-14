import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Map as MapIcon, X, Info, Layers, Eye, EyeOff, MoveVertical, Loader2, ArrowRight, Settings, Check, Globe, ArrowUp, ArrowDown, Copy, Camera, Save } from 'lucide-react';
import { fetchLayers, fetchMaps, createMap, updateMap, deleteMap, cloneMap, fetchMapById, fetchBasemaps, BASE_URL } from '../api';

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

const MapBuilder = () => {
    const [maps, setMaps] = useState([]);
    const [layers, setLayers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedMapId, setSelectedMapId] = useState(null);
    const [editingMap, setEditingMap] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        config: { zoom: 2, center: [0, 0] },
        projection: 'EPSG:3857',
        selectedLayers: [],
        selectedBasemaps: []
    });
    const [basemaps, setBasemaps] = useState([]);
    const [loading, setLoading] = useState(false);
    const sanitizedApiUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const mapViewerRef = React.useRef(null);

    const handleCaptureView = async () => {
        if (mapViewerRef.current && mapViewerRef.current.getViewState) {
            const state = mapViewerRef.current.getViewState();
            if (state) {
                // Update the edited map's config directly via API, or just update local formData if we were editing?
                // The prompt says "interactively set the initial extent".
                // Since this is a preview of an EXISTING map (mostly), we should likely update that map's config.
                // However, the user might be previewing *before* opening the modal... wait.
                // The "Live View" button is on the card.

                if (window.confirm(`Update map initial extent?\nZoom: ${state.zoom.toFixed(2)}\nCenter: [${state.center[0].toFixed(4)}, ${state.center[1].toFixed(4)}]`)) {

                    try {
                        // Fetch the LATEST full map data to ensure we don't lose layers/basemaps
                        const fullMapRes = await fetchMapById(selectedMapId);
                        const mapToUpdate = fullMapRes.data;

                        if (mapToUpdate) {
                            const currentConfig = typeof mapToUpdate.config === 'string' ? JSON.parse(mapToUpdate.config) : (mapToUpdate.config || {});
                            const newConfig = { ...currentConfig, zoom: state.zoom, center: state.center };

                            await updateMap(selectedMapId, {
                                ...mapToUpdate,
                                config: newConfig,
                                layers: mapToUpdate.layers?.map((l, i) => ({
                                    id: l.id,
                                    z_index: l.z_index !== undefined ? l.z_index : i,
                                    opacity: l.opacity,
                                    visible: l.visible !== 0 && l.visible !== false
                                })) || [],
                                basemaps: mapToUpdate.basemaps?.map(b => ({
                                    id: b.id,
                                    is_default: b.is_default
                                })) || []
                            });

                            alert('Initial extent updated successfully!');
                            loadData();
                        }
                    } catch (e) {
                        console.error('Failed to update view', e);
                        alert('Failed to save view: ' + e.message);
                    }
                }
            }
        } else {
            alert('Map viewer not ready or plugin outdated.');
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [mapsRes, layersRes, basemapsRes] = await Promise.all([fetchMaps(), fetchLayers(), fetchBasemaps()]);
            const parsedMaps = mapsRes.data.map(m => ({
                ...m,
                config: typeof m.config === 'string' ? JSON.parse(m.config) : m.config
            }));
            setMaps(parsedMaps);
            setLayers(layersRes.data);
            setBasemaps(basemapsRes.data);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    };

    const handleOpenModal = async (map = null) => {
        if (map) {
            setLoading(true);
            try {
                // Fetch full map details with layers
                const fullMapRes = await fetchMapById(map.id);
                const fullMap = fullMapRes.data;
                setEditingMap(fullMap);
                setFormData({
                    title: fullMap.title,
                    description: fullMap.description || '',
                    config: fullMap.config || { zoom: 2, center: [0, 0] },
                    projection: fullMap.projection || 'EPSG:3857',
                    selectedLayers: fullMap.layers ? fullMap.layers.map(l => ({
                        ...l,
                        visible: l.visible !== 0 && l.visible !== false
                    })) : [],
                    selectedBasemaps: fullMap.basemaps || []
                });
            } catch (err) {
                console.error('Failed to fetch map details:', err);
                // Fallback to basic data if fetch fails
                setEditingMap(map);
                setFormData({
                    title: map.title,
                    description: map.description || '',
                    config: map.config || { zoom: 2, center: [0, 0] },
                    projection: map.projection || 'EPSG:3857',
                    selectedLayers: []
                });
            } finally {
                setLoading(false);
            }
        } else {
            setEditingMap(null);
            setFormData({
                title: '',
                description: '',
                config: { zoom: 2, center: [0, 0] },
                projection: 'EPSG:3857',
                selectedLayers: [],
                selectedBasemaps: []
            });
        }
        setIsModalOpen(true);
    };

    const toggleLayer = (layer) => {
        const isSelected = formData.selectedLayers.find(l => l.id === layer.id);
        if (isSelected) {
            setFormData({
                ...formData,
                selectedLayers: formData.selectedLayers.filter(l => l.id !== layer.id)
            });
        } else {
            setFormData({
                ...formData,
                selectedLayers: [...formData.selectedLayers, {
                    ...layer,
                    z_index: formData.selectedLayers.length,
                    opacity: 1.0,
                    visible: true
                }]
            });
        }
    };

    const toggleBasemap = (basemap) => {
        const isSelected = formData.selectedBasemaps.find(b => b.id === basemap.id);
        if (isSelected) {
            setFormData({
                ...formData,
                selectedBasemaps: formData.selectedBasemaps.filter(b => b.id !== basemap.id)
            });
        } else {
            setFormData({
                ...formData,
                selectedBasemaps: [...formData.selectedBasemaps, { ...basemap, is_default: formData.selectedBasemaps.length === 0 }]
            });
        }
    };

    const setDefaultBasemap = (basemapId) => {
        setFormData({
            ...formData,
            selectedBasemaps: formData.selectedBasemaps.map(b => ({
                ...b,
                is_default: b.id === basemapId
            }))
        });
    };

    const moveLayer = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === formData.selectedLayers.length - 1) return;

        const newLayers = [...formData.selectedLayers];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];

        setFormData({
            ...formData,
            selectedLayers: newLayers
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const mapData = {
                ...formData,
                layers: formData.selectedLayers.map((l, i) => ({
                    id: l.id,
                    z_index: i,
                    opacity: l.opacity || 1.0,
                    visible: l.visible !== false
                })),
                basemaps: formData.selectedBasemaps.map(b => ({
                    id: b.id,
                    is_default: !!b.is_default
                }))
            };

            if (editingMap) {
                await updateMap(editingMap.id, mapData);
            } else {
                await createMap(mapData);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this map?')) return;
        try {
            await deleteMap(id);
            loadData();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleClone = async (id) => {
        try {
            await cloneMap(id);
            loadData();
        } catch (err) {
            console.error('Clone failed:', err);
        }
    };

    const toggleLayerVisibility = (index) => {
        const newLayers = [...formData.selectedLayers];
        newLayers[index].visible = newLayers[index].visible === undefined ? false : !newLayers[index].visible;
        setFormData({
            ...formData,
            selectedLayers: newLayers
        });
    };

    return (
        <div className="flex flex-col gap-6 lg:gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">Map Architect</h2>
                    <p className="text-slate-500 mt-1 font-medium">Compose multiple layers into specialized map experiences</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-slate-800 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-slate-200"
                >
                    <Plus size={20} /> Create New Map
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {maps.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-[32px]">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <MapIcon size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold text-lg">No maps architectural plans found.</p>
                        <p className="text-slate-400 text-sm mt-1">Start by creating your first map configuration.</p>
                    </div>
                )}
                {maps.map(map => (
                    <div key={map.id} className="glass-card group overflow-hidden flex flex-col">
                        <div className="h-40 bg-slate-50 relative flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 to-gray-500/10" />
                            <MapIcon size={48} className="text-slate-200 group-hover:scale-110 group-hover:text-slate-300 transition-all duration-700" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleClone(map.id); }}
                                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-slate-600 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                                    title="Clone Map"
                                >
                                    <Copy size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(map); }}
                                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-slate-600 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                                >
                                    <Settings size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(map.id); }}
                                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-slate-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{map.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-2 mt-2 font-medium h-10 leading-relaxed">{map.description}</p>

                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(map.id);
                                            // You might want to add a toast notification here in a real app
                                            alert(`Map ID ${map.id} copied to clipboard!`);
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors font-mono"
                                        title="Click to copy Map ID"
                                    >
                                        ID: {map.id}
                                    </button>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1.5 rounded-lg uppercase tracking-wider">
                                        <Layers size={14} /> {map.layer_count || 0}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedMapId(map.id);
                                        setIsPreviewOpen(true);
                                    }}
                                    className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 flex items-center gap-1.5 transition-all group/btn"
                                >
                                    Live View <Eye size={14} className="group-hover/btn:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Map Builder Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in duration-300 flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{editingMap ? 'Refine Map Design' : 'New Map Architecture'}</h3>
                                <p className="text-sm text-slate-500 mt-1 font-medium">Compose and layer your data sources.</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
                            <div className="w-full md:w-1/3 border-r border-slate-100 p-8 flex flex-col gap-8 overflow-y-auto">
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Map Title</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 transition-all font-medium"
                                            placeholder="e.g. Sales Territory Map"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Project Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 h-24 resize-none transition-all font-medium leading-relaxed"
                                            placeholder="Describe the purpose of this map..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 border-t border-slate-100 pt-7">
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Initial Zoom</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="22"
                                                value={formData.config?.zoom ?? 2}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    config: { ...formData.config, zoom: parseInt(e.target.value) || 0 }
                                                })}
                                                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 transition-all font-medium text-sm"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Longitude (X)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.config?.center?.[0] ?? 0}
                                                onChange={e => {
                                                    const lon = parseFloat(e.target.value) || 0;
                                                    const lat = formData.config?.center?.[1] ?? 0;
                                                    setFormData({
                                                        ...formData,
                                                        config: { ...formData.config, center: [lon, lat] }
                                                    });
                                                }}
                                                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 transition-all font-medium text-sm"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Latitude (Y)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.config?.center?.[1] ?? 0}
                                                onChange={e => {
                                                    const lon = formData.config?.center?.[0] ?? 0;
                                                    const lat = parseFloat(e.target.value) || 0;
                                                    setFormData({
                                                        ...formData,
                                                        config: { ...formData.config, center: [lon, lat] }
                                                    });
                                                }}
                                                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 transition-all font-medium text-sm"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2 col-span-2 lg:col-span-3">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Map Projection (CRS)</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={formData.projection}
                                                    onChange={e => setFormData({ ...formData, projection: e.target.value })}
                                                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 cursor-pointer appearance-none transition-all font-medium text-sm"
                                                >
                                                    {COMMON_PROJECTIONS.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={formData.projection}
                                                    onChange={e => setFormData({ ...formData, projection: e.target.value })}
                                                    className="w-40 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none text-slate-800 font-mono text-sm"
                                                    placeholder="Custom EPSG..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-8">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">
                                        <Globe size={16} /> Basemap Selection
                                    </h4>
                                    <div className="flex flex-col gap-3">
                                        {formData.selectedBasemaps.length === 0 && (
                                            <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                                <p className="text-xs text-slate-400 font-bold italic">No basemaps selected.</p>
                                            </div>
                                        )}
                                        {formData.selectedBasemaps.map((b) => (
                                            <div key={b.id} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group shadow-sm hover:border-slate-300 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        onClick={() => setDefaultBasemap(b.id)}
                                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${b.is_default ? 'bg-slate-800 border-slate-800' : 'border-slate-300 hover:border-slate-400'}`}
                                                    >
                                                        {b.is_default && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-700 block leading-none">{b.name}</span>
                                                        <span className="text-[10px] text-slate-400 mt-0.5 block">{b.is_default ? 'Default Provider' : 'Secondary Provider'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleBasemap(b)}
                                                    className="p-1.5 text-slate-300 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-8">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
                                            <Layers size={16} /> Stack Order
                                        </h4>
                                        <div className="text-[10px] font-bold text-slate-300 uppercase hidden sm:block">Drag to reorder</div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {formData.selectedLayers.length === 0 && (
                                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                                <p className="text-xs text-slate-400 font-bold italic">No layers selected yet.</p>
                                            </div>
                                        )}
                                        {formData.selectedLayers.map((l, idx) => (
                                            <div
                                                key={l.id}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', idx);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = 'move';
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
                                                    if (sourceIdx !== idx) {
                                                        const newLayers = [...formData.selectedLayers];
                                                        const [movedItem] = newLayers.splice(sourceIdx, 1);
                                                        newLayers.splice(idx, 0, movedItem);
                                                        setFormData({
                                                            ...formData,
                                                            selectedLayers: newLayers
                                                        });
                                                    }
                                                }}
                                                className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between group shadow-sm hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="cursor-move text-slate-300 group-hover:text-slate-600 transition-colors">
                                                        <MoveVertical size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-700 block leading-none">{l.name}</span>
                                                        <span className="text-[10px] uppercase font-bold text-slate-300 mt-1 block">{l.type}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => moveLayer(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-0 transition-all"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => moveLayer(idx, 'down')}
                                                        disabled={idx === formData.selectedLayers.length - 1}
                                                        className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-0 transition-all"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <div class="h-4 w-px bg-slate-100 mx-1"></div>
                                                    <button
                                                        onClick={() => toggleLayerVisibility(idx)}
                                                        className={`p-1.5 transition-all ${l.visible !== false ? 'text-slate-600 bg-slate-100 rounded-lg' : 'text-slate-300 hover:text-slate-500'}`}
                                                        title={l.visible !== false ? 'Visible' : 'Hidden'}
                                                    >
                                                        {l.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                                                    </button>
                                                    <button
                                                        onClick={() => toggleLayer(l)}
                                                        className="p-1.5 text-slate-300 hover:text-rose-600 transition-all ml-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-50/50 p-8 overflow-y-auto">
                                <section className="mb-10">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                        <h4 className="text-lg font-bold text-slate-800">Available Basemaps</h4>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Catalog</div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
                                        {basemaps.map(b => {
                                            const isSelected = formData.selectedBasemaps.find(sb => sb.id === b.id);
                                            return (
                                                <button
                                                    key={b.id}
                                                    onClick={() => toggleBasemap(b)}
                                                    className={`
                                                        p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center gap-3
                                                        ${isSelected
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                                                    `}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                        <Globe size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`font-bold text-sm truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-800'}`}>{b.name}</div>
                                                        <div className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400 opacity-60'}`}>{b.type}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-t border-slate-100 pt-8">
                                        <h4 className="text-lg font-bold text-slate-800">Data Layers</h4>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WMS / WFS / ArcGIS</div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
                                        {layers.map(l => {
                                            const isSelected = formData.selectedLayers.find(sl => sl.id === l.id);
                                            return (
                                                <button
                                                    key={l.id}
                                                    onClick={() => toggleLayer(l)}
                                                    className={`
                                                        p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center gap-3
                                                        ${isSelected
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                                                    `}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                        <Layers size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`font-bold text-sm truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-800'}`}>{l.name}</div>
                                                        <div className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400 opacity-60'}`}>{l.type}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="p-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-6">
                            <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                    <Info size={18} />
                                </div>
                                <p className="max-w-md">Top items in the stack list will be rendered over the items below them (Z-Index ordering).</p>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none px-10 py-4 text-slate-500 hover:text-slate-800 font-bold text-sm transition-all whitespace-nowrap">Discard Changes</button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="flex-1 sm:flex-none bg-slate-800 text-white px-12 py-4 rounded-2xl font-bold hover:bg-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    Finalize Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Preview Modal */}
            {
                isPreviewOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsPreviewOpen(false)} />
                        <div className="w-full h-full max-w-7xl max-h-[85vh] rounded-[40px] overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] relative animate-in zoom-in duration-500 bg-white">
                            <div className="absolute top-8 left-8 z-[70] flex items-center gap-4">
                                <div className="bg-slate-900/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 pointer-events-none flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                                    <h3 className="text-white font-bold text-sm tracking-widest uppercase">
                                        Live Architectural Preview
                                    </h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="absolute top-8 right-8 text-white/50 hover:text-white hover:scale-110 transition-all bg-white/10 p-3 rounded-2xl z-[210] backdrop-blur-md border border-white/10 hover:border-white/30"
                            >
                                <X size={32} />
                            </button>

                            <div className="w-full h-full">
                                <map-viewer
                                    ref={mapViewerRef}
                                    map-id={selectedMapId}
                                    api-key="internal_admin_preview"
                                    api-url={sanitizedApiUrl}
                                    style={{ width: '100%', height: '100%' }}
                                ></map-viewer>
                            </div>

                            <div className="absolute bottom-8 right-24 z-[70]">
                                <button
                                    onClick={handleCaptureView}
                                    className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/50 shadow-2xl flex items-center gap-3 text-slate-800 font-bold hover:scale-105 transition-all text-xs uppercase tracking-wider"
                                >
                                    <Camera size={16} className="text-slate-600" />
                                    Set Initial Extent
                                </button>
                            </div>

                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[70]">
                                <div className="bg-white/80 backdrop-blur-md px-8 py-3 rounded-3xl border border-white shadow-2xl flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] font-black uppercase text-slate-800 tracking-[0.2em]">All Sources Latent</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-200" />
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-slate-500" />
                                        <span className="text-[10px] font-black uppercase text-slate-800 tracking-[0.2em]">
                                            {maps.find(m => m.id === selectedMapId)?.projection || 'EPSG:3857'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default MapBuilder;
