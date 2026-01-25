import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { createLayer } from './layer-factory';
import { BASEMAPS } from './basemaps';
import axios from 'axios';
import 'ol/ol.css';

class MapViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.map = null;
    this.config = null;
    this.currentBasemapKey = 'OSM';
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
    this.render();
    const initialBasemap = this.getAttribute('basemap') || 'OSM';

    if (BASEMAPS[initialBasemap]) {
      this.currentBasemapKey = initialBasemap;
    }

    this.debounceLoad();
    this.setupBasemapSwitcher();
  }

  setupBasemapSwitcher() {
    const switcher = this.shadowRoot.querySelector('#basemap-switcher');
    if (!switcher) return;

    switcher.addEventListener('change', (e) => {
      this.setBasemap(e.target.value);
    });
  }

  setBasemap(key) {
    if (!this.map || !BASEMAPS[key]) return;

    // Find and remove existing basemap
    const layers = this.map.getLayers().getArray();
    const basemapLayer = layers.find(l => l.get('id') === 'basemap');
    if (basemapLayer) {
      this.map.removeLayer(basemapLayer);
    }

    // Add new basemap at the bottom (index 0)
    const newBasemap = BASEMAPS[key].create();
    this.map.getLayers().insertAt(0, newBasemap);
    this.currentBasemapKey = key;
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
    console.log('[MapViewer] Initializing OpenLayers Map');
    const { config, layers } = this.config;

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

    // Initial basemap
    const basemap = BASEMAPS[this.currentBasemapKey].create();

    const center = config.center || [0, 0];
    const zoom = config.zoom || 2;

    // Validation: Check for Latitude/Longitude inversion
    if (Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) {
      console.warn(`[MapViewer] CRITICAL: Invalid Coordinates detected: [${center[0]}, ${center[1]}]. 
        Are your Longitude/Latitude values swapped? Map might fail to render.`);
    }

    this.map = new Map({
      target: this.shadowRoot.querySelector('#map'),
      layers: [basemap, ...olLayers],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
        projection: 'EPSG:3857' // Standard web projection
      }),
    });

    // Add click listener for Identification
    this.map.on('singleclick', (evt) => {
      this.handleMapClick(evt);
    });

    // Ensure map resizes correctly
    setTimeout(() => this.map.updateSize(), 100);
  }

  async handleMapClick(evt) {
    const viewResolution = this.map.getView().getResolution();
    const popup = this.shadowRoot.querySelector('#popup');
    popup.style.display = 'none';
    popup.innerHTML = '';

    const results = [];

    // Check WMS Layers for GetFeatureInfo
    this.map.getLayers().forEach(layer => {
      const source = layer.getSource();
      if (source && typeof source.getFeatureInfoUrl === 'function') {
        const url = source.getFeatureInfoUrl(
          evt.coordinate,
          viewResolution,
          'EPSG:3857',
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
      if (layer) {
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
    }
  }

  showPopup(pixel, results) {
    const popup = this.shadowRoot.querySelector('#popup');
    popup.style.display = 'block';
    popup.style.left = `${pixel[0]}px`;
    popup.style.top = `${pixel[1]}px`;

    let content = '<div style="max-height: 200px; overflow-y: auto;">';
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
      <div style="background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; min-width: 150px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
          <span style="font-weight: bold; font-size: 11px; color: #fff;">Feature Info</span>
          <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">&times;</button>
        </div>
        ${content}
      </div>
    `;
  }

  render() {
    const basemapOptions = Object.keys(BASEMAPS).map(key =>
      `<option value="${key}" ${key === this.currentBasemapKey ? 'selected' : ''}>${BASEMAPS[key].name}</option>`
    ).join('');

    this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css" type="text/css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    position: relative;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }
                #map-container {
                    width: 100%;
                    height: 100%;
                    background: #f8fafc;
                    position: relative;
                    overflow: hidden;
                }
                #map {
                    width: 100%;
                    height: 100%;
                }
                .ol-control button {
                    background-color: rgba(255, 255, 255, 0.8) !important;
                    color: #1e293b !important;
                    border: 1px solid rgba(0, 0, 0, 0.05) !important;
                    border-radius: 12px !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
                    backdrop-filter: blur(8px) !important;
                    width: 40px !important;
                    height: 40px !important;
                    font-size: 20px !important;
                    margin: 4px !important;
                    transition: all 0.2s ease !important;
                }
                .ol-control button:hover {
                    background-color: #fff !important;
                    scale: 1.05;
                }
                .ol-zoom {
                    top: 20px !important;
                    left: 20px !important;
                }
                .control-panel {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    z-index: 1000;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(16px);
                    padding: 16px;
                    border-radius: 24px;
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    color: #1e293b;
                    min-width: 180px;
                }
                .control-panel .title {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #64748b;
                    margin-bottom: 8px;
                    display: block;
                }
                .control-panel select {
                    background: white;
                    color: #1e293b;
                    border: 1px solid #e2e8f0;
                    padding: 8px 12px;
                    border-radius: 12px;
                    width: 100%;
                    outline: none;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 12px;
                    transition: all 0.2s ease;
                }
                .control-panel select:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
            </style>
            <div id="map-container">
                <div id="map"></div>
                <div class="control-panel">
                    <span class="title">Basemap Selection</span>
                    <select id="basemap-switcher">
                        ${basemapOptions}
                    </select>
                </div>
            </div>
            <div id="popup" style="position: absolute; z-index: 2000; display: none; pointer-events: none;"></div>
        `;
  }
}

customElements.define('map-viewer', MapViewer);
