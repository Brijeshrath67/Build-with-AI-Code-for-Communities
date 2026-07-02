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

export const getAllStock = () =>
  api.get('/api/v1/stock');

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

export const declineTransfer = (transferId: number, reason: string) =>
  api.post(`/api/v1/transfer/decline/${transferId}`, { reason });

export const withdrawTransfer = (transferId: number) =>
  api.post(`/api/v1/transfer/withdraw/${transferId}`);

// ============ FORECASTS ============
export const getForecasts = (phcId: number) =>
  api.get(`/api/v1/forecast/${phcId}`);

// ============ MATCH ENGINE ============
export const getMatches = (phcId: number, medicine: string, quantity: number) =>
  api.get(`/api/v1/match/${phcId}`, { params: { medicine, required_quantity: quantity } });

// ============ ALERTS ============
export const getActiveAlerts = (phcId?: number) =>
  api.get('/api/v1/alerts/active', { params: phcId ? { phc_id: phcId } : {} });

export const getNotificationInbox = (phcId?: number) =>
  api.get('/api/v1/alerts/inbox', { params: phcId ? { phc_id: phcId } : {} });

export const getNotificationHistory = (phcId?: number) =>
  api.get('/api/v1/alerts/inbox/history', { params: phcId ? { phc_id: phcId } : {} });

export const markAlertAsRead = (alertId: number) =>
  api.post(`/api/v1/alerts/read/${alertId}`);

export const getAlertHistory = (phcId?: number) =>
  api.get('/api/v1/alerts/history', { params: phcId ? { phc_id: phcId } : {} });

export const sendBroadcastMessage = (data: { title: string; message: string; severity?: string }) =>
  api.post('/api/v1/alerts/broadcast', data);

// ============ DASHBOARD ============
export const getDistrictDashboard = (district: string) =>
  api.get(`/api/v1/dashboard/district/${encodeURIComponent(district)}`);

// ============ PHCs ============
export const getAllPHCs = () =>
  api.get('/api/v1/dashboard/district/all');

export const getNetworkStatus = () =>
  api.get('/api/v1/dashboard/network');

export const reassignDoctor = (doctorId: number, newPhcId: number) =>
  api.post('/api/v1/dashboard/reassign-doctor', { doctor_id: doctorId, new_phc_id: newPhcId });

// ============ NL QUERY ============
export const sendNLQuery = (query: string, phcId?: number) =>
  api.post('/api/v1/query', { query, phc_id: phcId });

export default api;
