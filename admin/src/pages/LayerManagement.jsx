import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Globe, Server, Database, X, Check, Loader2, Layers, Search, Filter, MoreVertical, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { fetchLayers, createLayer, updateLayer, deleteLayer, cloneLayer, API_URL } from '../api';
import StyleEditor from '../components/StyleEditor';
import axios from 'axios';

const LAYER_TYPES = ['WMS', 'WFS', 'WFS-T', 'XYZ', 'ArcGIS_Rest', 'ArcGIS_Feature_Server', 'WMTS', 'OGC_API_Features', 'GeoServer_REST', 'OSM'];

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

                // Extract formats
                const formatNodes = xml.querySelectorAll('GetMap > Format');
                const formats = Array.from(new Set(Array.from(formatNodes).map(n => n.textContent)));
                setFormData(prev => ({ ...prev, discoveredFormats: formats }));

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

                // WMS is generally not editable via standard means (unless WFS-T is coupled, but we treat them separate here)
                setFormData(prev => ({ ...prev, is_editable: false }));

                if (projections.length > 0 && !formData.projection) {
                    setFormData(prev => ({ ...prev, projection: projections[0] }));
                }
                if (formats.length > 0 && !formData.params.format) {
                    setFormData(prev => ({ ...prev, params: { ...prev.params, format: formats[0] } }));
                }
            } else if (formData.type === 'ArcGIS_Rest' || formData.type === 'ArcGIS_Feature_Server') {
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(targetUrl)}&f=json`, { responseType: 'arraybuffer' });
                const data = res.data instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(res.data)) : res.data;

                if (data.spatialReference?.wkid) {
                    const wkid = `EPSG:${data.spatialReference.wkid}`;
                    setDiscoveredProjections([wkid]);
                    setFormData(prev => ({ ...prev, projection: wkid }));
                }

                // If it's a specific layer (has fields)
                if (data.fields) {
                    const fields = data.fields.map(f => f.name);
                    const isEditable = (data.capabilities && (data.capabilities.includes('Create') || data.capabilities.includes('Update') || data.capabilities.includes('Editing')));

                    setFormData(prev => ({
                        ...prev,
                        availableFields: fields,
                        // Auto-select some fields if empty
                        params: { ...prev.params, identify_fields: prev.params.identify_fields || fields.slice(0, 5).join(',') },
                        is_editable: !!isEditable
                    }));
                }

                if (data.layers) {
                    setDiscoveredLayers(data.layers.map(l => ({
                        name: String(l.id),
                        title: l.name,
                        // If it's FeatureServer, constructing the layer URL is useful
                        layerUrl: targetUrl.endsWith('/') ? `${targetUrl}${l.id}` : `${targetUrl}/${l.id}`,
                        fields: l.fields?.map(f => f.name).join(','),
                        legend_url: targetUrl.endsWith('/') ? `${targetUrl}legend` : `${targetUrl}/legend`
                    })));

                    // For MapServer root, editing is usually false unless specific layer says otherwise
                    // For FeatureServer root, check capabilities
                    const isEditable = (data.capabilities && (data.capabilities.includes('Create') || data.capabilities.includes('Update') || data.capabilities.includes('Editing')));
                    // Only enable if Feature Server. ArcGIS Map Server (Rest) is generally view only. 
                    if (formData.type === 'ArcGIS_Feature_Server') {
                        setFormData(prev => ({ ...prev, is_editable: !!isEditable }));
                    } else {
                        setFormData(prev => ({ ...prev, is_editable: false }));
                    }
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

                // Extract formats (OutputFormat)
                const formatNodes = xml.querySelectorAll('Operation[name="GetFeature"] Parameter[name="outputFormat"] Value, Operation[name="GetFeature"] > Parameter[name="outputFormat"] > Value');
                let formats = Array.from(new Set(Array.from(formatNodes).map(n => n.textContent)));

                if (formats.length === 0) {
                    formats = ['application/json', 'text/xml; subtype=gml/3.1.1', 'GML2'];
                }
                setFormData(prev => ({ ...prev, discoveredFormats: formats }));

                const typeNodes = xml.querySelectorAll('FeatureType > Name');
                const found = Array.from(typeNodes).map(node => ({
                    name: node.textContent,
                    title: node.parentElement.querySelector('Title')?.textContent || node.textContent
                })).filter(l => l.name);
                setDiscoveredLayers(found);

                // Check for Transaction capability
                const transactionNode = xml.querySelector('Operation[name="Transaction"]');
                setFormData(prev => ({ ...prev, is_editable: !!transactionNode }));

                if (projections.length > 0 && !formData.projection) {
                    setFormData(prev => ({ ...prev, projection: projections[0] }));
                }
                if (formats.includes('application/json') || formats.includes('json')) {
                    setFormData(prev => ({ ...prev, params: { ...prev.params, outputFormat: 'application/json' } }));
                }
            } else if (formData.type === 'WFS-T') {
                // Reuse WFS logic but force editable
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(targetUrl)}&service=WFS&request=GetCapabilities`, { responseType: 'arraybuffer' });
                const data = res.data instanceof ArrayBuffer ? new TextDecoder().decode(res.data) : res.data;
                const parser = new DOMParser();
                const xml = parser.parseFromString(data, 'text/xml');

                const srsNodes = xml.querySelectorAll('DefaultSRS, OtherSRS, DefaultCRS, OtherCRS');
                const projections = Array.from(new Set(Array.from(srsNodes).map(n => n.textContent))).filter(p => p.startsWith('EPSG:'));
                setDiscoveredProjections(projections);

                const typeNodes = xml.querySelectorAll('FeatureType > Name');
                const found = Array.from(typeNodes).map(node => ({
                    name: node.textContent,
                    title: node.parentElement.querySelector('Title')?.textContent || node.textContent
                })).filter(l => l.name);
                setDiscoveredLayers(found);

                // Force editable for WFS-T
                setFormData(prev => ({ ...prev, is_editable: true }));
                if (projections.length > 0 && !formData.projection) {
                    setFormData(prev => ({ ...prev, projection: projections[0] }));
                }
                setFormData(prev => ({ ...prev, params: { ...prev.params, outputFormat: 'application/json' } }));

            } else if (formData.type === 'OGC_API_Features') {
                // Fetch Collections
                const collectionsUrl = targetUrl.endsWith('/') ? `${targetUrl}collections` : `${targetUrl}/collections`;
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(collectionsUrl)}`, { headers: { 'Accept': 'application/json' } });
                const data = res.data;

                if (data.collections) {
                    setDiscoveredLayers(data.collections.map(c => ({
                        name: c.id,
                        title: c.title || c.id,
                        description: c.description
                    })));
                    // OGC API Features is typically vector and editable if supported. Default to editable for now as it's modern WFS.
                    setFormData(prev => ({ ...prev, is_editable: true, params: { ...prev.params, outputFormat: 'application/json' } }));
                }
            } else if (formData.type === 'GeoServer_REST') {
                // Try fetching layers list
                const layersUrl = targetUrl.endsWith('/') ? `${targetUrl}layers.json` : `${targetUrl}/layers.json`;
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(layersUrl)}`, { headers: { 'Accept': 'application/json' } });

                if (res.data && res.data.layers && res.data.layers.layer) {
                    setDiscoveredLayers(res.data.layers.layer.map(l => ({
                        name: l.name,
                        title: l.name,
                        href: l.href
                    })));
                    setFormData(prev => ({ ...prev, is_editable: false })); // REST is configuration, viewing is typically WMS
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

    // Helper to fetch attributes for a specific layer
    const fetchAttributesForLayer = async (layerName, type, url) => {
        const proxyBase = `${API_URL}/proxy`;
        try {
            if (type === 'WMS' || type === 'WFS') {
                // Try WFS DescribeFeatureType
                let describeUrl = `${url}${url.includes('?') ? '&' : '?'}service=WFS&version=1.1.0&request=DescribeFeatureType&typename=${layerName}`;
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(describeUrl)}`, { responseType: 'text' });
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(res.data, "text/xml");
                const elements = xmlDoc.querySelectorAll('element, xsd\\:element, xs\\:element');
                const fields = [];
                elements.forEach(el => {
                    const name = el.getAttribute('name');
                    const type = el.getAttribute('type');
                    if (name && type && !['the_geom', 'geom', 'geometry', 'shape', 'msGeometry'].includes(name) && !type.startsWith('gml:')) {
                        fields.push(name);
                    }
                });
                return [...new Set(fields)];
            } else if (type === 'ArcGIS_Feature_Server' || type === 'ArcGIS_Rest') {
                // If the URL already points to a layer, we can't append /index easily if it ends with a number
                // But generally layerUrl is constructed as base/id
                // If we are at root, we need to construct the layer URL

                // Try to find if layerName is an ID or Name. 
                // For ArcGIS, our discovery sets name = ID. 
                const layerUrl = url.endsWith('/') ? `${url}${layerName}` : `${url}/${layerName}`;
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(layerUrl)}&f=json`);
                if (res.data.fields) {
                    return res.data.fields.map(f => f.name);
                }
            } else if (type === 'OGC_API_Features') {
                const queryablesUrl = url.endsWith('/') ? `${url}collections/${layerName}/queryables` : `${url}/collections/${layerName}/queryables`;
                try {
                    const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(queryablesUrl)}`, { headers: { 'Accept': 'application/json' } });
                    if (res.data && res.data.properties) {
                        return Object.keys(res.data.properties);
                    }
                } catch (e) {
                    // Fallback if queryables not supported, maybe try items?
                    // Or just empty
                }
            } else if (type === 'GeoServer_REST') {
                // Fetch layer resource
                // Assumes layerName is the full name "workspace:layer"
                // This typically requires auth, so we might just return empty or try a best guess if mapped to WFS/WMS
                // Logic: If user selected GeoServer_REST, they might just want to configure names.
                return [];
            } else if (type === 'WFS-T') {
                let describeUrl = `${url}${url.includes('?') ? '&' : '?'}service=WFS&version=1.1.0&request=DescribeFeatureType&typename=${layerName}`;
                const res = await axios.get(`${proxyBase}?url=${encodeURIComponent(describeUrl)}`, { responseType: 'text' });
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(res.data, "text/xml");
                const elements = xmlDoc.querySelectorAll('element, xsd\\:element, xs\\:element');
                const fields = [];
                elements.forEach(el => {
                    const name = el.getAttribute('name');
                    const type = el.getAttribute('type');
                    if (name && type && !['the_geom', 'geom', 'geometry', 'shape', 'msGeometry'].includes(name) && !type.startsWith('gml:')) {
                        fields.push(name);
                    }
                });
                return [...new Set(fields)];
            }
        } catch (e) {
            console.warn(`Failed to fetch attributes for ${layerName}`, e);
            return [];
        }
        return [];
    };

    const toggleDiscoveredLayer = async (layerName) => {
        const layer = discoveredLayers.find(l => l.name === layerName);
        if (!layer) return;

        // --- Single selection enforcement for Vector Types ---
        const isSingleSelect = ['WFS', 'WFS-T', 'ArcGIS_Feature_Server', 'GeoJSON', 'OGC_API_Features'].includes(formData.type);

        let newLayers = [];
        const currentLayers = formData.params.layers ? formData.params.layers.split(',').filter(Boolean) : [];
        const isSelected = currentLayers.includes(layerName);

        if (isSingleSelect) {
            // If checking a new one, it replaces the old one. If unchecking, it clears.
            if (isSelected) {
                newLayers = [];
            } else {
                newLayers = [layerName];
            }
        } else {
            // Multi-select allowed (WMS, WMTS, etc.)
            if (isSelected) {
                newLayers = currentLayers.filter(l => l !== layerName);
            } else {
                newLayers = [...currentLayers, layerName];
            }
        }

        // --- Attribute Logic ---
        // We maintain a map of layer -> availableFields in state or just fetch on demand?
        // Let's store available fields in a temporary way or just rely on fetching.
        // For better UX, we should fetch fields for the newly selected layer(s) to populate the config.

        // Helper to update available fields in state
        const updateFieldsForLayers = async (layersToFetch) => {
            // We only really need to fetch for the *last* added layer to show its fields immediately, 
            // but we should store them for all. 
            // Currently formData.availableFields is a flat list. 
            // We will introduce formData.params.layer_attributes to store config.

            // For simplicity, let's fetch fields for the toggle layer if it was added.
            if (!isSelected) {
                const fields = await fetchAttributesForLayer(layerName, formData.type, formData.url);
                if (fields.length > 0) {
                    // Check specific logic for ArcGIS - if we found fields, we might also check for specific layer editability
                    if (formData.type === 'ArcGIS_Feature_Server') {
                        // Check if this specific layer is editable
                        // We might need to do a specific fetch, but we can rely on root capability for now as a fallback
                    }
                }

                // Update global availableFields for the "Create New" flow where we just show fields of the last selected
                // But for the intelligent per-layer config, we need to store it deeper.
                // We'll update the 'layer_attributes' param.

                // Initialize default attributes for this layer
                const defaultAttrs = fields.slice(0, 5).join(',');

                // Update state
                setFormData(prev => {
                    const currentLayerAttributes = prev.params.layer_attributes ? JSON.parse(prev.params.layer_attributes) : {};

                    // If single select, we might want to clear others?
                    const nextLayerAttributes = isSingleSelect ? {} : { ...currentLayerAttributes };

                    nextLayerAttributes[layerName] = {
                        identify_fields: defaultAttrs,
                        available_fields: fields // Store available fields so we don't re-fetch!
                    };

                    return {
                        ...prev,
                        availableFields: fields, // For backward compatibility / immediate display
                        params: {
                            ...prev.params,
                            layers: newLayers.join(','),
                            identify_fields: defaultAttrs, // Update main identify_fields for compat
                            layer_attributes: JSON.stringify(nextLayerAttributes)
                        }
                    };
                });
            } else {
                // Removing a layer
                setFormData(prev => {
                    const currentLayerAttributes = prev.params.layer_attributes ? JSON.parse(prev.params.layer_attributes) : {};
                    if (currentLayerAttributes[layerName]) {
                        delete currentLayerAttributes[layerName];
                    }
                    return {
                        ...prev,
                        params: {
                            ...prev.params,
                            layers: newLayers.join(','),
                            layer_attributes: JSON.stringify(currentLayerAttributes)
                        }
                    };
                });
            }
        };

        // Execute field update
        if (!isSelected) { // Adding
            await updateFieldsForLayers([layerName]);
        } else { // Removing
            setFormData(prev => ({
                ...prev,
                params: { ...prev.params, layers: newLayers.join(',') }
            }));
        }
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
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
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
                                            (formData.type === 'WFS' || formData.type === 'WFS-T') ? 'https://demo.boundary.org/geoserver/wfs' :
                                                formData.type === 'XYZ' ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' :
                                                    formData.type === 'OGC_API_Features' ? 'https://demo.ldproxy.net/vineyards' :
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
                                                const isSingleSelect = ['WFS', 'WFS-T', 'ArcGIS_Feature_Server', 'GeoJSON', 'OGC_API_Features'].includes(formData.type);

                                                return (
                                                    <button
                                                        key={l.name}
                                                        type="button"
                                                        onClick={() => toggleDiscoveredLayer(l.name)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-${isSingleSelect ? 'full' : 'md'} flex items-center justify-center border ${isSelected ? 'bg-white text-blue-600 border-white' : 'border-slate-200'}`}>
                                                            {isSelected && (isSingleSelect ? <div className="w-2.5 h-2.5 rounded-full bg-blue-600" /> : <Check size={12} strokeWidth={4} />)}
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
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Identify Properties</label>

                                {formData.params.layers && formData.params.layers.split(',').filter(Boolean).length > 0 ? (
                                    <div className="flex flex-col gap-4">
                                        {formData.params.layers.split(',').filter(Boolean).map(layerName => {
                                            // Get attributes for this layer
                                            const layerAttrs = formData.params.layer_attributes ? JSON.parse(formData.params.layer_attributes) : {};
                                            const config = layerAttrs[layerName] || {};
                                            const availableForLayer = config.available_fields || formData.availableFields || [];
                                            const selectedForLayer = (config.identify_fields || formData.params.identify_fields || '').split(',');

                                            return (
                                                <div key={layerName} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                                    <div className="bg-slate-100/50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                                                        <Layers size={14} className="text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-700">{layerName}</span>
                                                    </div>
                                                    <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
                                                        {availableForLayer.length > 0 ? availableForLayer.map(field => {
                                                            const isFieldSelected = selectedForLayer.includes(field);
                                                            return (
                                                                <label key={`${layerName}-${field}`} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer hover:text-blue-600">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isFieldSelected}
                                                                        onChange={(e) => {
                                                                            // Update nested state
                                                                            const currentConfig = layerAttrs[layerName] || { available_fields: availableForLayer };
                                                                            const currentFields = (currentConfig.identify_fields || '').split(',').filter(Boolean);
                                                                            let nextFields;

                                                                            if (e.target.checked) nextFields = [...currentFields, field];
                                                                            else nextFields = currentFields.filter(f => f !== field);

                                                                            const newLayerConfig = {
                                                                                ...currentConfig,
                                                                                identify_fields: nextFields.join(',')
                                                                            };

                                                                            const newLayerAttributes = {
                                                                                ...layerAttrs,
                                                                                [layerName]: newLayerConfig
                                                                            };

                                                                            // Update visible identify_fields for backward compat if it's the first/only layer
                                                                            const isFirst = formData.params.layers.split(',')[0] === layerName;
                                                                            const newIdentifyFields = isFirst ? nextFields.join(',') : formData.params.identify_fields;

                                                                            setFormData({
                                                                                ...formData,
                                                                                params: {
                                                                                    ...formData.params,
                                                                                    layer_attributes: JSON.stringify(newLayerAttributes),
                                                                                    identify_fields: newIdentifyFields
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <span className="truncate" title={field}>{field}</span>
                                                                </label>
                                                            );
                                                        }) : (
                                                            <p className="col-span-2 text-[10px] text-slate-400 italic text-center py-2">No fields discovered for this layer.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
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
                                )}
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

                            {/* Format Selection - WMS/WFS/FeatureServer/OGC */}
                            {(formData.type === 'WMS' || formData.type === 'WFS' || formData.type === 'WFS-T' || formData.type === 'ArcGIS_Feature_Server' || formData.type === 'OGC_API_Features') && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Output Format</label>
                                    <div className="relative">
                                        <select
                                            value={formData.type === 'WMS' ? (formData.params?.format || 'image/png') : (formData.params?.outputFormat || 'application/json')}
                                            onChange={e => {
                                                const key = formData.type === 'WMS' ? 'format' : 'outputFormat';
                                                setFormData({
                                                    ...formData,
                                                    params: { ...formData.params, [key]: e.target.value }
                                                });
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none text-slate-800 cursor-pointer appearance-none transition-all font-medium"
                                        >
                                            {formData.discoveredFormats && formData.discoveredFormats.length > 0 ? (
                                                formData.discoveredFormats.map(f => <option key={f} value={f}>{f}</option>)
                                            ) : (
                                                <>
                                                    <option value={formData.type === 'WMS' ? 'image/png' : 'application/json'}>Default ({formData.type === 'WMS' ? 'image/png' : 'json'})</option>
                                                    {formData.type === 'WMS' && <option value="image/jpeg">image/jpeg</option>}
                                                    {(formData.type === 'WFS' || formData.type === 'WFS-T') && <option value="GML2">GML2</option>}
                                                    {formData.type === 'ArcGIS_Feature_Server' && <option value="json">EsriJSON</option>}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Styling - For Vector Types Only */}
                            {(formData.type === 'WFS' || formData.type === 'WFS-T' || formData.type === 'GeoJSON' || formData.type === 'ArcGIS_Feature_Server' || formData.type === 'OGC_API_Features') && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 tracking-tight">Vector Styling</label>
                                    <StyleEditor
                                        value={formData.params?.style}
                                        onChange={(newStyle) => setFormData({
                                            ...formData,
                                            params: { ...formData.params, style: newStyle }
                                        })}
                                        availableFields={formData.availableFields}
                                    />
                                    <p className="text-[10px] text-slate-400 ml-2 font-medium italic">Customize the appearance of vector features.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 transition-all ${formData.is_editable ? 'cursor-pointer hover:border-blue-200 hover:bg-blue-50/50' : 'cursor-not-allowed opacity-60'}`}>
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.is_editable ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                        {formData.is_editable && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        disabled={!formData.is_editable && !['WFS', 'WFS-T', 'ArcGIS_Feature_Server', 'OGC_API_Features'].includes(formData.type)}
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
        case 'WFS-T': return <Database className="text-pink-600" />;
        case 'ArcGIS_Rest': return <Globe className="text-emerald-600" />;
        case 'ArcGIS_Feature_Server': return <Globe className="text-teal-600" />;
        case 'WMTS': return <Layers className="text-violet-600" />;
        case 'OGC_API_Features': return <Database className="text-orange-600" />;
        case 'GeoServer_REST': return <Server className="text-cyan-600" />;
        case 'OSM': return <Globe className="text-amber-600" />;
        default: return <Database className="text-slate-600" />;
    }
};

export default LayerManagement;
