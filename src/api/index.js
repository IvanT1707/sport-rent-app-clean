import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
