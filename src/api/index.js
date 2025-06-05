import axios from 'axios';

// Enhanced environment detection
const getApiBaseUrl = () => {
  // Development - use Vite proxy
  if (process.env.NODE_ENV === 'development' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return '/api';
  }
  
  // Production - use same origin (fullstack app on Render)
  return window.location.origin + '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true,
  timeout: 30000 // 30 seconds timeout for Render cold starts
});

// Log the API configuration
console.log('API Configuration:');
console.log('- Environment:', process.env.NODE_ENV || 'development');
console.log('- Base URL:', api.defaults.baseURL);
console.log('- Origin:', window.location.origin);

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  } catch (error) {
    console.error('Error in request interceptor:', error);
    return config;
  }
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.error || error.message
    });
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      console.warn('Authentication failed - user may need to login again');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to get the current user's token
const getToken = async () => {
  try {
    const { auth } = await import('../firebase');
    const user = auth.currentUser;
    
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }
    
    const token = await user.getIdToken();
    console.log('Token obtained for user:', user.uid);
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// API Functions
export const getEquipment = async () => {
  try {
    console.log('Fetching equipment...');
    const response = await api.get('/equipment');
    
    // Handle both response formats for compatibility
    if (response.data.success) {
      return { data: response.data.data }; // New format
    } else if (Array.isArray(response.data)) {
      return { data: response.data }; // Legacy format
    } else {
      return response.data; // Pass through as is
    }
  } catch (error) {
    console.error('Error fetching equipment:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch equipment');
  }
};

export const createRental = async (rentalData) => {
  try {
    console.log('Creating rental:', rentalData);
    const response = await api.post('/rentals', rentalData);
    
    if (response.data.success) {
      return response.data.data;
    } else {
      return response.data;
    }
  } catch (error) {
    console.error('Error creating rental:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to create rental';
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

export const getRentals = async () => {
  try {
    console.log('Fetching user rentals...');
    const response = await api.get('/rentals');
    
    if (response.data.success) {
      return { data: response.data.data };
    } else if (response.data.data) {
      return response.data;
    } else {
      return { data: [] };
    }
  } catch (error) {
    console.error('Error fetching rentals:', error);
    
    if (error.response?.status === 401) {
      throw new Error('Please log in to view your rentals');
    }
    
    throw new Error(error.response?.data?.error || 'Failed to fetch rentals');
  }
};

export const deleteRental = async (id) => {
  try {
    console.log('Deleting rental:', id);
    const response = await api.delete(`/rentals/${id}`);
    
    return response.data;
  } catch (error) {
    console.error('Error deleting rental:', error);
    
    if (error.response?.status === 404) {
      throw new Error('Rental not found');
    } else if (error.response?.status === 403) {
      throw new Error('You are not authorized to delete this rental');
    }
    
    throw new Error(error.response?.data?.error || 'Failed to delete rental');
  }
};

// Health check function
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

export default {
  getEquipment,
  createRental,
  getRentals,
  deleteRental,
  healthCheck
};