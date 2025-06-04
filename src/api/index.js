import axios from 'axios';

// Enhanced environment detection
const getApiBaseUrl = () => {
  // If we're in development or production, use relative URL (handled by Vite proxy in dev)
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api'; // This will be proxied by Vite in development
  }
  // In production, use the current origin
  return window.location.origin + '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true,
  timeout: 10000 // 10 seconds timeout
});

// Log the API configuration
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('API Base URL:', api.defaults.baseURL);
console.log('Current Origin:', window.location.origin);

// Add a request interceptor to include the auth token
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Helper function to get the current user's token
const getToken = async () => {
  const { auth } = await import('../firebase');
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
};

export const getEquipment = async () => {
  try {
    const response = await api.get('/equipment');
    return response.data;
  } catch (error) {
    console.error('Error fetching equipment:', error);
    throw error;
  }
};

export const createRental = async (rentalData) => {
  try {
    const response = await api.post('/rentals', rentalData);
    return response.data;
  } catch (error) {
    console.error('Error creating rental:', error);
    throw error;
  }
};

export const getRentals = async () => {
  try {
    const response = await api.get('/rentals');
    return response.data;
  } catch (error) {
    console.error('Error fetching rentals:', error);
    throw error;
  }
};

export const deleteRental = async (id) => {
  try {
    const response = await api.delete(`/rentals/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting rental:', error);
    throw error;
  }
};

export default {
  getEquipment,
  createRental,
  getRentals,
  deleteRental,
};
