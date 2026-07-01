import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create an axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Inject JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('phc_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('phc_token');
      localStorage.removeItem('phc_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const login = (phone: string, password: string) =>
  api.post('/api/v1/auth/login', { phone, password });

export const register = (data: any) =>
  api.post('/api/v1/auth/register', data);

// ============ STOCK ============
export const getStock = (phcId: number) =>
  api.get(`/api/v1/stock/${phcId}`);

export const updateStock = (data: any) =>
  api.post('/api/v1/stock/update', data);

export const deleteStock = (stockId: number, password: string) =>
  api.delete(`/api/v1/stock/${stockId}`, { data: { password } });

// ============ TRANSFERS ============
export const getTransferLedger = () =>
  api.get('/api/v1/transfer/ledger');

export const createTransfer = (data: any) =>
  api.post('/api/v1/transfer/create', data);

export const approveTransfer = (transferId: number) =>
  api.post(`/api/v1/transfer/approve/${transferId}`);

// ============ FORECASTS ============
export const getForecasts = (phcId: number) =>
  api.get(`/api/v1/forecast/${phcId}`);

// ============ MATCH ENGINE ============
export const getMatches = (phcId: number, medicine: string, quantity: number) =>
  api.get(`/api/v1/match/${phcId}`, { params: { medicine, required_quantity: quantity } });

// ============ ALERTS ============
export const getActiveAlerts = (phcId?: number) =>
  api.get('/api/v1/alerts/active', { params: phcId ? { phc_id: phcId } : {} });

// ============ DASHBOARD ============
export const getDistrictDashboard = (district: string) =>
  api.get(`/api/v1/dashboard/district/${encodeURIComponent(district)}`);

// ============ PHCs ============
export const getAllPHCs = () =>
  api.get('/api/v1/dashboard/district/all');

// ============ NL QUERY ============
export const sendNLQuery = (query: string, phcId?: number) =>
  api.post('/api/v1/query', { query, phc_id: phcId });

export default api;
