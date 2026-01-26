import axios from 'axios';

export const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
export const API_URL = `${BASE_URL}/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': 'Bearer dev_token'
    }
});

// For development, we'll use a hardcoded token or no auth if not implemented yet
// In real app, we'd add interceptors for the JWT token
export const fetchLayers = () => api.get('/layers');
export const fetchMaps = () => api.get('/maps');
export const fetchMapById = (id) => api.get(`/maps/${id}`);
export const createMap = (data) => api.post('/maps', data);
export const updateMap = (id, data) => api.put(`/maps/${id}`, data);
export const deleteMap = (id) => api.delete(`/maps/${id}`);
export const createLayer = (data) => api.post('/layers', data);
export const updateLayer = (id, data) => api.put(`/layers/${id}`, data);
export const deleteLayer = (id) => api.delete(`/layers/${id}`);
export const fetchApiKeys = () => api.get('/keys');
export const createApiKey = (data) => api.post('/keys', data);
export const updateApiKey = (id, data) => api.put(`/keys/${id}`, data);
export const deleteApiKey = (id) => api.delete(`/keys/${id}`);

// Clone API
export const cloneMap = (id) => api.post(`/maps/${id}/clone`);
export const cloneLayer = (id) => api.post(`/layers/${id}/clone`);

export const fetchBasemaps = () => api.get('/basemaps');
export const createBasemap = (data) => api.post('/basemaps', data);
export const updateBasemap = (id, data) => api.put(`/basemaps/${id}`, data);
export const deleteBasemap = (id) => api.delete(`/basemaps/${id}`);

export default api;
