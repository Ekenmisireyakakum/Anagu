import axios from 'axios';

const rawApiBase = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = rawApiBase.includes('localhost:3001') ? '' : rawApiBase;

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const gisApi = {
  getParcels: (params?: { status?: string; lga?: string }) =>
    apiClient.get('/gis/parcels', { params }),
  verifyParcel: (data: { wkt: string; applicationId: string; excludeParcelId?: string }) =>
    apiClient.post('/gis/verify', data),
  getParcelGeoJSON: (id: string) =>
    apiClient.get(`/gis/parcels/${id}/geojson`),
};
