import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createLayer } from './layer-factory';
import { createBasemapLayer } from './basemaps';
import { setupEditing } from './editor-tools';
import axios from 'axios';
import 'ol/ol.css';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import MousePosition from 'ol/control/MousePosition';
import { createStringXY } from 'ol/coordinate';
import { defaults as defaultControls } from 'ol/control';

// Layer Registry & Providers
import { layerRegistry } from './layer-registry';
import { OSMProvider } from './layers/providers/OSMProvider';
import { WMSProvider } from './layers/providers/WMSProvider';
import { XYZProvider } from './layers/providers/XYZProvider';
import { WFSProvider } from './layers/providers/WFSProvider';
import { ArcGISFeatureServerProvider } from './layers/providers/ArcGISFeatureServerProvider';
import { ArcGISRestProvider } from './layers/providers/ArcGISRestProvider';
import { WMTSProvider } from './layers/providers/WMTSProvider';
import { VectorProvider } from './layers/providers/VectorProvider';
import { GeoJSON } from 'ol/format';
import { Vector as VectorSource } from 'ol/source';
import { Draw } from 'ol/interaction';

// Register Standard Providers
layerRegistry.register(OSMProvider);
layerRegistry.register(WMSProvider);
layerRegistry.register(XYZProvider);
layerRegistry.register(WFSProvider);
layerRegistry.register(ArcGISFeatureServerProvider);
layerRegistry.register(ArcGISRestProvider);
layerRegistry.register(WMTSProvider);
layerRegistry.register(VectorProvider);

// Common Projections Registration
proj4.defs("EPSG:2056", "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=besel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:21781", "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=besel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:2100", "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=-199.87,74.79,246.62,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:3035", "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321425 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs");

register(proj4);

class MapViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.map = null;
    this.config = null;
    this.currentBasemapKey = 'OSM';
    this.basemapPanelOpen = false;
    this.basemapPanelOpen = false;
    this.layerPanelOpen = false;
    this.editingLayerIdx = null; // Track which layer is being edited
    this.editorTools = null; // Store active interaction tools
    this.drawInteraction = null;
  }

  static get observedAttributes() {
    return ['map-id', 'api-key', 'api-url', 'basemap'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`[MapViewer] Attribute ${name}: "${oldValue}" -> "${newValue}"`);
    if (oldValue === newValue) return;

    if (name === 'basemap' && this.map) {
      this.setBasemap(newValue);
    } else if (['map-id', 'api-key', 'api-url'].includes(name)) {
      this.debounceLoad();
    }
  }

  debounceLoad() {
    if (this.loadTimeout) clearTimeout(this.loadTimeout);
    this.loadTimeout = setTimeout(() => {
      const mapId = this.getAttribute('map-id');
      const apiKey = this.getAttribute('api-key');
      const apiUrl = this.getAttribute('api-url') || 'http://localhost:3000';

      console.log(`[MapViewer] Load Requested: mapId=${mapId}, apiKey=${apiKey ? '***' : 'MISSING'}`);
      if (mapId && apiKey) {
        this.loadMapConfig(apiUrl, mapId, apiKey);
      }
    }, 50);
  }

  async connectedCallback() {
    console.log('[MapViewer] Component Connected');
    this.debounceLoad();
  }


  async loadMapConfig(apiUrl, mapId, apiKey) {
    console.log(`[MapViewer] Fetching config from ${apiUrl}/api/viewer/${mapId}`);
    try {
      const response = await axios.get(`${apiUrl}/api/viewer/${mapId}`, {
        headers: { 'x-api-key': apiKey }
      });
      console.log('[MapViewer] Config loaded successfully:', response.data);
      this.config = response.data;
      this.initMap();
    } catch (err) {
      console.error('[MapViewer] Failed to load map configuration:', err);
      this.shadowRoot.querySelector('#map-container').innerHTML =
        `<div style="color: #ef4444; padding: 24px; font-family: 'Inter', sans-serif; background: #fee2e2; border: 1px solid #fecaca; border-radius: 16px; margin: 20px;">
          <h4 style="margin: 0 0 8px 0; font-size: 16px;">Map Load Failure</h4>
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">${err.message}</p>
          <div style="margin-top: 12px; font-family: monospace; font-size: 11px; color: #b91c1c;">
            Check Backend: ${apiUrl}<br>
            Map ID: ${mapId}
          </div>
        </div>`;
    }
  }

  initMap() {
    if (!this.config) return;
    this.renderLayout();

    // CLEANUP: If a map already exists, destroy it and clear containers
    if (this.map) {
      console.log('[MapViewer] Cleaning up existing map instance');
      this.map.setTarget(null);
      this.map = null;

      const mousePos = this.shadowRoot.getElementById('mouse-position');
      if (mousePos) mousePos.innerHTML = '';

      const mapDiv = this.shadowRoot.getElementById('map');
      if (mapDiv) mapDiv.innerHTML = '';
    }

    console.log('[MapViewer] Initializing OpenLayers Map');
    const { config, layers, basemaps: apiBasemaps, projection: mapProjection } = this.config;
    const finalProjection = mapProjection || config.projection || 'EPSG:3857';

    const apiUrl = this.getAttribute('api-url') || 'http://localhost:3000';

    const olLayers = layers
      .map(l => {
        const layer = createLayer(l, apiUrl);
        if (layer) {
          layer.set('name', l.name);
          layer.set('config', l); // Attach full config for identify
        }
        return layer;
      })
      .filter(l => l !== null);

    // Dynamic Basemaps
    const basemapsToUse = (apiBasemaps && apiBasemaps.length > 0)
      ? apiBasemaps
      : [{ id: 'osm', name: 'OpenStreetMap', type: 'OSM' }];

    // HONOR DEFAULT BASEMAP: Find the one with is_default property
    const defaultBasemapConfig = basemapsToUse.find(b => b.is_default) || basemapsToUse[0];
    this.currentBasemapKey = defaultBasemapConfig.id;
    const basemap = createBasemapLayer(defaultBasemapConfig);

    // Call render AFTER setting the currentBasemapKey to ensure active selection is shown
    this.render();

    const center = config.center || [0, 0];
    const zoom = config.zoom || 2;

    // Validation: Check for Latitude/Longitude inversion
    if (Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) {
      console.warn(`[MapViewer] CRITICAL: Invalid Coordinates detected: [${center[0]}, ${center[1]}]. 
        Are your Longitude/Latitude values swapped? Map might fail to render.`);
    }

    const mousePositionControl = new MousePosition({
      coordinateFormat: createStringXY(2),
      projection: finalProjection,
      className: 'mapviewer-coords-overlay',
      target: this.shadowRoot.getElementById('mouse-position'),
      undefinedHTML: '&nbsp;',
    });

    this.map = new Map({
      target: this.shadowRoot.querySelector('#map'),
      layers: [basemap, ...olLayers],
      controls: defaultControls({ attribution: false }).extend([mousePositionControl]),
      view: new View({
        center: fromLonLat(center, finalProjection),
        zoom: zoom,
        projection: finalProjection
      }),
    });

    // Add click listener for Identification
    this.map.on('singleclick', (evt) => {
      this.handleMapClick(evt);
    });

    // Ensure map resizes correctly
    setTimeout(() => this.map.updateSize(), 100);

    // Stop propagation on overlays to prevent map interaction
    const stopEvents = (id) => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) return;
      ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'scroll'].forEach(evt => {
        el.addEventListener(evt, (e) => e.stopPropagation(), { passive: false });
      });
    };

    // Attach to containers and triggers
    ['popup', 'layer-panel', 'basemap-panel', 'trigger-layers', 'trigger-basemaps'].forEach(id => stopEvents(id));
  }

  async handleMapClick(evt) {
    if (this.editorTools) return; // Disable identification while editing

    const viewResolution = this.map.getView().getResolution();
    const popup = this.shadowRoot.querySelector('#popup');
    popup.style.display = 'none';
    popup.innerHTML = '';

    const results = [];

    // Check WMS Layers for GetFeatureInfo
    this.map.getLayers().forEach(layer => {
      const source = layer.getSource();
      if (layer.getVisible() && source && typeof source.getFeatureInfoUrl === 'function') {
        const url = source.getFeatureInfoUrl(
          evt.coordinate,
          viewResolution,
          this.map.getView().getProjection(),
          { 'INFO_FORMAT': 'application/json' }
        );
        if (url) {
          results.push(axios.get(url).then(res => ({
            layerName: layer.get('name') || 'WMS Layer',
            features: res.data.features || [],
            config: layer.get('config') // We'll pass config here
          })).catch(() => null));
        }
      }
    });

    // Check Vector Layers
    this.map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      if (layer && layer.getVisible()) {
        results.push(Promise.resolve({
          layerName: layer.get('name') || 'Vector Layer',
          features: [feature],
          config: layer.get('config')
        }));
      }
    });

    const resolvedResults = (await Promise.all(results)).filter(r => r && r.features.length > 0);

    if (resolvedResults.length > 0) {
      this.showPopup(evt.pixel, resolvedResults);

      // Dispatch API Event
      const features = resolvedResults.flatMap(r => r.features);
      this.dispatchEvent(new CustomEvent('features-selected', {
        detail: { features: new GeoJSON().writeFeaturesObject(features) },
        bubbles: true,
        composed: true
      }));
    }
  }

  showPopup(pixel, results) {
    const popup = this.shadowRoot.querySelector('#popup');
    popup.style.display = 'block';
    popup.style.left = `${pixel[0]}px`;
    popup.style.top = `${pixel[1]}px`;

    let content = '<div class="custom-scrollbar" style="max-height: 200px; overflow-y: auto; padding-right: 12px;">';
    results.forEach(res => {
      const identifyFields = res.config?.params?.identify_fields?.split(',').map(f => f.trim()) || [];

      res.features.forEach((feature, idx) => {
        const properties = feature.properties || (typeof feature.getProperties === 'function' ? feature.getProperties() : {});
        content += `<div style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
          <strong style="color: #60a5fa; font-size: 10px; text-transform: uppercase;">${res.layerName}</strong>`;

        if (identifyFields.length > 0) {
          identifyFields.forEach(field => {
            if (properties[field] !== undefined) {
              content += `<div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 2px;">
                <span style="color: #94a3b8;">${field}:</span>
                <span style="color: #f8fafc; font-weight: bold;">${properties[field]}</span>
              </div>`;
            }
          });
        } else {
          // Fallback: show first 3 properties if none configured
          Object.keys(properties).slice(0, 3).forEach(key => {
            if (key !== 'geometry' && typeof properties[key] !== 'object') {
              content += `<div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 2px;">
                <span style="color: #94a3b8;">${key}:</span>
                <span style="color: #f8fafc;">${properties[key]}</span>
              </div>`;
            }
          });
        }
        content += '</div>';
      });
    });
    content += '</div>';

    popup.innerHTML = `
      <div class="popup-content" style="background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; min-width: 150px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); pointer-events: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
          <span style="font-weight: bold; font-size: 11px; color: #fff;">Feature Info</span>
          <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">&times;</button>
        </div>
        ${content}
      </div>
    `;
  }

  togglePanel(panel) {
    if (panel === 'basemap') {
      this.basemapPanelOpen = !this.basemapPanelOpen;
      if (this.basemapPanelOpen) this.layerPanelOpen = false;
    } else {
      this.layerPanelOpen = !this.layerPanelOpen;
      if (this.layerPanelOpen) this.basemapPanelOpen = false;
    }
    this.updateUI();
  }

  renderLayout() {
    this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css" type="text/css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                :host { display: block; width: 100%; height: 100%; position: relative; font-family: 'Inter', sans-serif; }
                #map-container { width: 100%; height: 100%; position: relative; overflow: hidden; }
                #map { width: 100%; height: 100%; }
                
                .control-trigger {
                    position: absolute; width: 48px; height: 48px; border-radius: 16px;
                    background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; z-index: 1001; transition: all 0.3s ease;
                }
                .trigger-layers { top: 20px; right: 20px; }
                .trigger-basemaps { bottom: 20px; right: 20px; }
                .control-trigger:hover { background: #fff; transform: scale(1.05); }
                .control-trigger.active { background: #3b82f6; color: white; border-color: #3b82f6; }

                .panel {
                   position: absolute; z-index: 1000; background: rgba(255, 255, 255, 0.9);
                   backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.5);
                   border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                   opacity: 0; pointer-events: none; transform: scale(0.9) translateY(10px);
                   transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .panel.show { opacity: 1; pointer-events: auto; transform: scale(1) translateY(0); }
                
                .layer-panel { top: 76px; right: 10px; width: 300px; max-height: calc(100% - 160px); display: flex; flex-direction: column; }
                .basemap-panel { bottom: 80px; right: 10px; padding: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 260px; max-width: calc(100vw - 20px); }
                
                .panel-header { padding: 16px; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; }
                .layer-list { flex: 1; overflow-y: auto; padding: 12px; }
                .layer-item { background: rgba(255,255,255,0.4); border-radius: 14px; margin-bottom: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.2); }
                .layer-main { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
                .layer-name { font-size: 13px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
                
                .basemap-card { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; padding: 8px; border-radius: 16px; transition: all 0.2s ease; }
                .basemap-card.active { background: rgba(59, 130, 246, 0.1); }
                .basemap-thumb { width: 44px; height: 44px; border-radius: 12px; border: 2px solid transparent; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                .basemap-card.active .basemap-thumb { border-color: #3b82f6; transform: scale(1.05); }
                
                .legend-container { display: none; margin-top: 8px; padding: 8px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }
                .legend-container.show { display: block; }
                .legend-container img { max-width: 100%; border-radius: 4px; }
                .legend-btn { 
                    background: none; border: 1px solid #3b82f6; color: #3b82f6; 
                    border-radius: 6px; padding: 2px 8px; font-size: 10px; 
                    font-weight: 600; cursor: pointer; margin-top: 4px;
                    transition: all 0.2s ease;
                }
                .legend-btn:hover { background: #3b82f6; color: white; }
                
                .mapviewer-coords-overlay {
                    position: absolute !important; bottom: 20px !important; left: 20px !important; z-index: 1000 !important;
                    pointer-events: none !important; white-space: nowrap !important;
                    font-family: ui-monospace, monospace !important;
                    color: #0f172a !important; font-size: 11px !important; font-weight: 800 !important;
                    /* Strong Halo effect - Multiple layers for thickness */
                    text-shadow: 
                        -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
                        0 0 8px #fff, 0 0 8px #fff !important;
                    background: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .ol-zoom { top: 20px !important; left: 20px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }
                .ol-control button {
                    background: rgba(255, 255, 255, 0.8) !important; 
                    backdrop-filter: blur(12px) !important;
                    color: #1e293b !important;
                    border: 1px solid rgba(255, 255, 255, 0.5) !important;
                    border-radius: 12px !important;
                    width: 38px !important;
                    height: 38px !important;
                    font-size: 20px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: all 0.2s ease !important;
                }
                .ol-control button:hover { background: #fff !important; transform: scale(1.05); }

                /* Custom Scrollbar for Popup and Lists */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }
            </style>
            <div id="map-container">
                <div id="map"></div>
                <div id="mouse-position" class="mapviewer-coords-overlay"></div>
                
                <div id="layer-panel" class="panel layer-panel">
                    <div class="panel-header">Layers</div>
                    <div id="layer-list" class="layer-list"></div>
                </div>

                <div id="basemap-panel" class="panel basemap-panel"></div>

                <div id="trigger-layers" class="control-trigger trigger-layers" onclick="this.getRootNode().host.togglePanel('layer')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                </div>

                <div id="trigger-basemaps" class="control-trigger trigger-basemaps" onclick="this.getRootNode().host.togglePanel('basemap')">
                    <span style="font-size: 20px;">🌍</span>
                </div>
            </div>
            <div id="popup" style="position: absolute; z-index: 2000; display: none; pointer-events: none;"></div>
        `;
    this.updateUI();
  }

  updateUI() {
    if (!this.config) return;

    const layerPanel = this.shadowRoot.getElementById('layer-panel');
    const basemapPanel = this.shadowRoot.getElementById('basemap-panel');
    const triggerLayers = this.shadowRoot.getElementById('trigger-layers');
    const triggerBasemaps = this.shadowRoot.getElementById('trigger-basemaps');

    if (this.layerPanelOpen) {
      layerPanel.classList.add('show');
      triggerLayers.classList.add('active');
    } else {
      layerPanel.classList.remove('show');
      triggerLayers.classList.remove('active');
    }

    if (this.editingLayerIdx !== null) {
      layerPanel.classList.add('show'); // Keep panel open while editing
    }

    if (this.basemapPanelOpen) {
      basemapPanel.classList.add('show');
      triggerBasemaps.classList.add('active');
    } else {
      basemapPanel.classList.remove('show');
      triggerBasemaps.classList.remove('active');
    }

    // Update Basemap List
    const { basemaps: apiBasemaps, layers: apiLayers } = this.config;
    const basemapsToUse = (apiBasemaps && apiBasemaps.length > 0) ? apiBasemaps : [{ id: 'osm', name: 'OpenStreetMap', type: 'OSM' }];

    basemapPanel.innerHTML = basemapsToUse.map(b => `
      <div class="basemap-card ${b.id === this.currentBasemapKey ? 'active' : ''}" onclick="this.getRootNode().host.setBasemap('${b.id}')">
        <div class="basemap-thumb" style="background: ${this.getBasemapColor(b.id)}">
          <span style="font-size: 20px;">${b.type === 'OSM' ? '🌍' : '🛰️'}</span>
        </div>
        <span style="font-size: 9px; font-weight: 700;">${b.name}</span>
      </div>
    `).join('');

    // Update Layer List
    const layerList = this.shadowRoot.getElementById('layer-list');
    const apiUrl = this.getAttribute('api-url') || 'http://localhost:3000';
    layerList.innerHTML = apiLayers.map((l, idx) => {
      let legendUrl = l.params?.legend_url;
      if (legendUrl && l.params?.use_proxy) {
        legendUrl = `${apiUrl}/api/proxy?url=${encodeURIComponent(legendUrl)}`;
      }

      return `
      <div class="layer-item">
        <div class="layer-main">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <input type="checkbox" ${(l.visible === undefined || l.visible === true || l.visible === 1) ? 'checked' : ''} onchange="this.getRootNode().host.toggleLayer(${idx}, this.checked)">
            <span class="layer-name">${l.name}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button onclick="this.getRootNode().host.moveLayer(${idx}, 'up')" style="background: white; border: 1px solid #e2e8f0; width: 24px; height: 24px; border-radius: 6px; cursor: pointer;">↑</button>
            <button onclick="this.getRootNode().host.moveLayer(${idx}, 'down')" style="background: white; border: 1px solid #e2e8f0; width: 24px; height: 24px; border-radius: 6px; cursor: pointer;">↓</button>
          </div>
        </div>
        <div style="padding-left: 28px; margin-top: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b;">
            <span>Opacity</span>
            <input type="range" min="0" max="1" step="0.1" value="${l.opacity !== undefined ? l.opacity : 1}" oninput="this.getRootNode().host.setLayerOpacity(${idx}, this.value)">
          </div>
          
          ${(l.type && (l.type.toUpperCase() === 'WFS' || l.type.toUpperCase() === 'VECTOR')) ? `
             <div style="display: flex; gap: 8px; margin-top: 6px;">
                 <button
                    onclick="this.getRootNode().host.toggleEditing(${idx})"
                    style="
                        flex: 1; padding: 4px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer;
                        border: 1px solid ${this.editingLayerIdx === idx ? '#3b82f6' : '#cbd5e1'};
                        background: ${this.editingLayerIdx === idx ? '#3b82f6' : '#fff'};
                        color: ${this.editingLayerIdx === idx ? '#fff' : '#475569'};
                    "
                 >
                    ${this.editingLayerIdx === idx ? 'Stop Editing' : 'Edit Features'}
                 </button>
                 ${this.editingLayerIdx === idx ? `
                 <button
                    onclick="this.getRootNode().host.saveEdits()"
                    style="
                        padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer;
                        border: 1px solid #10b981; background: #10b981; color: white;
                    "
                 >
                    Save
                 </button>
                    <!-- Draw Tools -->
                   <div style="display:flex; gap:2px; margin-left: 5px;">
                        <button onclick="this.getRootNode().host.startDrawing('Point')" title="Draw Point">📍</button>
                        <button onclick="this.getRootNode().host.startDrawing('LineString')" title="Draw Line">📈</button>
                        <button onclick="this.getRootNode().host.startDrawing('Polygon')" title="Draw Polygon">⬠</button>
                   </div>
                 ` : ''}
             </div>
          ` : ''}

          ${l.params?.legend_url ? `
            <button class="legend-btn" onclick="this.nextElementSibling.classList.toggle('show')">View Legend</button>
            <div class="legend-container">
              <img id="legend-img-${idx}" src="" alt="Legend" style="display:none">
              <span id="legend-loader-${idx}" style="font-size:10px; color:#94a3b8;">Loading...</span>
            </div>
          ` : ''}
        </div>
      </div>
    `}).reverse().join('');

    // Trigger loads after render
    apiLayers.forEach((l, idx) => {
      if (l.params?.legend_url) {
        this.loadLegend(l, idx, apiUrl);
      }
    });
  }

  render() {
    this.renderLayout();
  }

  getBasemapColor(id) {
    const colors = {
      'osm': '#e2e8f0',
      'goog-r': '#bae6fd',
      'goog-s': '#1e293b',
      'goog-h': '#1e293b',
      'goog-p': '#f1f5f9',
      'carto-d': '#0f172a'
    };
    return colors[id] || '#cbd5e1';
  }

  toggleLayer(idx, visible) {
    this.config.layers[idx].visible = visible;
    const layers = this.map.getLayers().getArray();
    const layer = layers[idx + 1];
    if (layer) layer.setVisible(visible);
    this.updateUI();
  }

  setLayerOpacity(idx, opacity) {
    this.config.layers[idx].opacity = parseFloat(opacity);
    const layers = this.map.getLayers().getArray();
    const layer = layers[idx + 1];
    if (layer) layer.setOpacity(parseFloat(opacity));
    this.updateUI();
  }

  moveLayer(idx, direction) {
    const layers = this.config.layers;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;

    if (targetIdx < 0 || targetIdx >= layers.length) return;

    // Swap in the config array
    const temp = layers[idx];
    layers[idx] = layers[targetIdx];
    layers[targetIdx] = temp;

    // Swap in OpenLayers
    const olLayers = this.map.getLayers();
    const currentOlIdx = idx + 1; // +1 for basemap
    const targetOlIdx = targetIdx + 1;

    const layer = olLayers.removeAt(currentOlIdx);
    olLayers.insertAt(targetOlIdx, layer);

    this.updateUI();
  }

  setBasemap(id) {
    const { basemaps: apiBasemaps } = this.config;
    const basemapConfig = apiBasemaps?.find(b => b.id === id) || (id === 'osm' ? { type: 'OSM' } : null);

    if (basemapConfig) {
      const layers = this.map.getLayers();
      const newBasemap = createBasemapLayer(basemapConfig);
      layers.setAt(0, newBasemap);
      this.currentBasemapKey = id;
      this.updateUI(); // Update active card in UI
    }
  }

  async loadLegend(layer, idx, apiUrl) {
    const img = this.shadowRoot.getElementById(`legend-img-${idx}`);
    const loader = this.shadowRoot.getElementById(`legend-loader-${idx}`);
    if (!img || !loader) return;

    let legendUrl = layer.params.legend_url;
    const useProxy = layer.params.use_proxy;

    // Determine if it's an ArcGIS REST Legend
    const isArcGIS = legendUrl.includes('/MapServer/legend') || legendUrl.includes('/FeatureServer/legend');

    if (isArcGIS) {
      try {
        // Always fetch JSON for ArcGIS
        const fetchUrl = useProxy
          ? `${apiUrl}/api/proxy?url=${encodeURIComponent(legendUrl)}&f=json`
          : `${legendUrl}?f=json`;

        const res = await axios.get(fetchUrl);
        const data = res.data;

        // Find the specific layer
        const layerId = parseInt(layer.params.layers); // "4" -> 4
        const layerLegend = data.layers?.find(l => l.layerId === layerId);

        if (layerLegend && layerLegend.legend && layerLegend.legend.length > 0) {
          // Use the first symbol in the legend or join them? Usually first is enough for simple layers.
          const imageData = layerLegend.legend[0].imageData;
          img.src = `data:image/png;base64,${imageData}`;
          img.style.display = 'block';
          loader.style.display = 'none';
        } else {
          throw new Error('Layer legend not found in response');
        }
      } catch (err) {
        console.error('Legend load failed', err);
        loader.innerText = 'Legend N/A';
      }
    } else {
      // Standard Image URL
      if (useProxy) {
        legendUrl = `${apiUrl}/api/proxy?url=${encodeURIComponent(legendUrl)}`;
      }
      img.src = legendUrl;
      img.onload = () => {
        img.style.display = 'block';
        loader.style.display = 'none';
      };
      img.onerror = () => {
        loader.innerText = 'Failed';
      };
    }
  }
  getViewState() {
    if (!this.map) return null;
    const view = this.map.getView();
    const center = toLonLat(view.getCenter());
    const zoom = view.getZoom();
    return { center, zoom };
  }

  toggleEditing(idx) {
    // If clicking the same layer, toggle off
    if (this.editingLayerIdx === idx) {
      this.stopEditing();
      return;
    }

    // Stop any existing editing
    this.stopEditing();

    const layer = this.map.getLayers().item(idx + 1); // +1 for basemap
    if (!layer) return;

    // Start editing
    this.editingLayerIdx = idx;
    const type = layer.get('config').type === 'Vector' ? 'Vector' : 'WFS';
    const tools = setupEditing(this.map, layer, type);

    if (tools) {
      this.editorTools = tools;
      console.log(`[MapViewer] Editing started for layer ${idx}`);
    } else {
      this.editingLayerIdx = null;
      console.warn('[MapViewer] Failed to start editing - not a WFS/Vector layer?');
    }
    this.updateUI();
  }

  stopEditing() {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    if (this.editorTools) {
      const { select, modify, snap } = this.editorTools;
      this.map.removeInteraction(select);
      this.map.removeInteraction(modify);
      this.map.removeInteraction(snap);
      this.editorTools = null;
    }
    this.editingLayerIdx = null;
    this.updateUI();
  }

  startDrawing(geometryType) {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
    }
    if (this.editingLayerIdx === null) return;

    const layer = this.map.getLayers().item(this.editingLayerIdx + 1);
    if (!layer) return;

    this.drawInteraction = new Draw({
      source: layer.getSource(),
      type: geometryType
    });
    this.map.addInteraction(this.drawInteraction);
  }

  async saveEdits() {
    if (this.editorTools && this.editorTools.saveChanges) {
      await this.editorTools.saveChanges();
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  zoomTo(coordinates, zoomLevel) {
    if (!this.map) return;
    const view = this.map.getView();
    const proj = view.getProjection();
    const pt = fromLonLat(coordinates, proj);
    view.animate({ center: pt, zoom: zoomLevel || view.getZoom(), duration: 1000 });
  }

  panTo(coordinates) {
    if (!this.map) return;
    const view = this.map.getView();
    const pt = fromLonLat(coordinates, view.getProjection());
    view.animate({ center: pt, duration: 1000 });
  }

  setZoom(zoom) {
    if (!this.map) return;
    this.map.getView().animate({ zoom: zoom, duration: 500 });
  }

  addVectorLayer(config) {
    if (!this.map) return;
    // config: { name, data: GeoJSON, style: {} }
    const InternalConfig = {
      name: config.name || 'New Layer',
      type: 'Vector',
      data: config.data,
      params: { style: config.style },
      visible: true,
      opacity: 1
    };

    const layer = createLayer(InternalConfig, null);
    if (layer) {
      layer.set('name', InternalConfig.name);
      layer.set('config', InternalConfig);
      this.map.addLayer(layer);
      this.config.layers.push(InternalConfig);
      this.updateUI();
      return this.config.layers.length - 1; // Return index/ID
    }
  }

  getLayers() {
    if (!this.map) return [];
    return this.config.layers.map((l, i) => ({ id: i, name: l.name, type: l.type, visible: l.visible }));
  }

  removeLayer(index) {
    if (!this.map || index < 0 || index >= this.config.layers.length) return;

    // Remove from OL
    const layers = this.map.getLayers();
    layers.removeAt(index + 1); // +1 for basemap

    // Remove from Config
    this.config.layers.splice(index, 1);
    this.updateUI();
  }

  exportLayer(index, format = 'geojson') {
    if (!this.map || index < 0 || index >= this.config.layers.length) return null;
    const layer = this.map.getLayers().item(index + 1);
    if (!layer) return null;

    const source = layer.getSource();
    if (source instanceof VectorSource) {
      const writer = new GeoJSON();
      const features = writer.writeFeaturesObject(source.getFeatures(), {
        featureProjection: this.map.getView().getProjection(),
        dataProjection: 'EPSG:4326'
      });
      return features;
    }
    return null;
  }

  addFeatures(index, features) {
    // features: GeoJSON object or array of features
    if (!this.map || index < 0 || index >= this.config.layers.length) return;
    const layer = this.map.getLayers().item(index + 1);
    const source = layer.getSource();

    if (source instanceof VectorSource) {
      const reader = new GeoJSON();
      const readFeatures = reader.readFeatures(features, {
        featureProjection: this.map.getView().getProjection(),
        dataProjection: 'EPSG:4326'
      });
      source.addFeatures(readFeatures);
    }
  }

  selectFeatures(geometry) {
    if (!geometry || !this.map) return;
    const view = this.map.getView();
    // Ensure we have GeoJSON format available (imported at top)
    const format = new GeoJSON();
    let searchGeom;

    try {
      searchGeom = format.readGeometry(geometry, {
        featureProjection: view.getProjection(),
        dataProjection: 'EPSG:4326'
      });
    } catch (e) {
      console.warn('Invalid geometry passed to selectFeatures', e);
      return;
    }

    const extent = searchGeom.getExtent();
    const selectedFeatures = [];

    // Iterate over vector layers to find intersecting features
    this.map.getLayers().forEach(layer => {
      const source = layer.getSource();
      // Check if source is VectorSource (imported as VectorSource)
      if (source instanceof VectorSource && layer.getVisible()) {
        source.forEachFeatureInExtent(extent, (feature) => {
          const featureGeom = feature.getGeometry();
          if (featureGeom && searchGeom.intersectsExtent(featureGeom.getExtent())) {
            // For more precise checking, we'd use JSTS or complex logic. 
            // Extent intersection is good for bounding box selection.
            // If searchGeom is Point, we should use source.getFeaturesAtCoordinate?
            // But existing API implies generic geometry.
            // If searchGeom is Point, intersectsExtent works if point is inside feature extent? No.

            // Refinement: If searchGeom type is Point, check distance or use getFeaturesAtCoordinate
            // But let's stick to extent for now as reliable basic implementation.
            // Actually, if searchGeom is a Polygon, we want features intersecting it.
            // intersectsExtent is a loose check (bbox). 
            // Ideally we check `featureGeom.intersects(searchGeom)` but OL doesn't support that directly.
            // We'll trust Extent for now.
            selectedFeatures.push(feature);
          }
        });
      }
    });

    // Update editor selection if active and features belong to edited layer
    if (this.editorTools && this.editorTools.select) {
      const select = this.editorTools.select;
      select.getFeatures().clear();

      const editedLayer = this.map.getLayers().item(this.editingLayerIdx + 1); // +1 for basemap
      if (editedLayer) {
        const source = editedLayer.getSource();
        const validFeatures = selectedFeatures.filter(f => source.hasFeature(f));
        validFeatures.forEach(f => select.getFeatures().push(f));
      }
    }

    // Dispatch event with found features
    if (selectedFeatures.length > 0) {
      const writer = new GeoJSON();
      const geojson = writer.writeFeaturesObject(selectedFeatures, {
        featureProjection: view.getProjection(),
        dataProjection: 'EPSG:4326'
      });
      this.dispatchEvent(new CustomEvent('features-selected', {
        detail: { features: geojson },
        bubbles: true,
        composed: true
      }));
    }
  }

  getSelectedFeatures() {
    if (this.editorTools && this.editorTools.select) {
      const features = this.editorTools.select.getFeatures().getArray();
      const writer = new GeoJSON();
      return writer.writeFeaturesObject(features, {
        featureProjection: this.map.getView().getProjection(),
        dataProjection: 'EPSG:4326'
      });
    }
    return [];
  }

  clearSelection() {
    if (this.editorTools && this.editorTools.select) {
      this.editorTools.select.getFeatures().clear();
    }
  }
}

customElements.define('map-viewer', MapViewer);
