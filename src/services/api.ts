import axios, { AxiosError } from 'axios';
import { socket } from './socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { API_BASE } from './config';

// Normalize base so it does not end with '/api' — endpoints include '/api', avoid '/api/api'
const normalizeHost = (raw?: string) => (raw || 'http://localhost:8080').replace(/\/api$/, '');

let currentBaseHost = typeof API_BASE !== 'undefined' ? normalizeHost(API_BASE) : 'http://localhost:8080';

export const api = axios.create({
  baseURL: currentBaseHost,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000 // Increased to 15 seconds for production
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Utility function to check if error is retryable
const isRetryableError = (error: AxiosError): boolean => {
  // Retry on network errors
  if (!error.response) return true;
  
  const status = error.response.status;
  // Retry on 5xx server errors and 429 (rate limit)
  if (status >= 500 || status === 429) return true;
  
  // Don't retry on 4xx client errors (except 429)
  return false;
};

// Exponential backoff delay
const getRetryDelay = (attempt: number): number => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 1000;
};

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const setApiBase = (base: string) => {
  currentBaseHost = normalizeHost(base)
  api.defaults.baseURL = currentBaseHost
  console.log('API base updated to', currentBaseHost)
}

// Discovery helper: try to fetch /api/config from a set of candidates
export const discoverBackend = async (): Promise<{ apiBase?: string; socketBase?: string } | null> => {
  const candidates = [
    currentBaseHost,
    'http://localhost:8080',
    typeof API_BASE !== 'undefined' ? normalizeHost(API_BASE) : undefined,
  ].filter(Boolean) as string[]

  for (const host of candidates) {
    try {
      const url = `${host}/api/config`
      console.log('Trying to discover backend at', url)
      const res = await axios.get(url, { timeout: 3000 })
      if (res?.data?.apiBase) {
        setApiBase(res.data.apiBase)
        return { apiBase: res.data.apiBase, socketBase: res.data.socketBase }
      }
    } catch (e) {
      // ignore and continue
    }
  }
  return null
}

// Function to get stored auth token
export const getAuthToken = async () => {
  return await AsyncStorage.getItem('userToken');
};

// Add request interceptor for auth token and logging
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    
    // Create new headers object if it doesn't exist
    config.headers = config.headers || {};
    
    if (token) {
      // Ensure Authorization header is set
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Normalize URL: ensure it starts with '/api' unless it's an absolute URL
    const urlStr = config.url || '';
    if (!/^https?:\/\//i.test(urlStr)) {
      if (!urlStr.startsWith('/api')) {
        config.url = urlStr.startsWith('/') ? `/api${urlStr}` : `/api/${urlStr}`;
      }
    }

    // Log request details
    console.log('\n=== API Request ===');
    console.log('URL:', `${config.baseURL || ''}${config.url || ''}`);
    console.log('Method:', config.method?.toUpperCase());
    console.log('Token present:', !!token);
    console.log('Headers:', JSON.stringify(config.headers, null, 2));
    if (config.data) {
      console.log('Data:', JSON.stringify(config.data, null, 2));
    }
    return config;
  } catch (error) {
    console.error('Error in request interceptor:', error);
    return Promise.reject(error);
  }
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

// Add response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    console.log('\n=== API Response ===');
    console.log('URL:', response.config.url);
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response;
  },
  async (error: AxiosError) => {
    console.error('\n=== API Error ===');
    console.error('URL:', error.config?.url);
    console.error('Status:', error.response?.status);
    console.error('Error Message:', error.message);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Request Headers:', JSON.stringify(error.config?.headers, null, 2));
    console.error('Response Headers:', JSON.stringify(error.response?.headers, null, 2));

    // If it's an auth error, log additional info
    if (error.response?.status === 401) {
      console.error('Authentication error detected');
      getAuthToken().then(token => {
        console.error('Current token:', token);
      });
    }

    // Retry logic
    const config = error.config as any;
    if (config && isRetryableError(error)) {
      // Initialize retry count if not present
      const retryCount = config.__retryCount || 0;

      if (retryCount < MAX_RETRIES) {
        config.__retryCount = retryCount + 1;
        const delay = getRetryDelay(retryCount);
        
        console.warn(`\n⚠️ Retrying request (${config.__retryCount}/${MAX_RETRIES}) after ${Math.round(delay)}ms`);
        console.warn(`URL: ${config.url}`);
        console.warn(`Error: ${error.message}`);
        
        Toast.show({
          type: 'info',
          text1: 'Connection Issue',
          text2: `Retrying... (${config.__retryCount}/${MAX_RETRIES})`,
          visibilityTime: 2000,
        });

        await sleep(delay);
        return api(config);
      } else {
        console.error(`\n❌ Max retries (${MAX_RETRIES}) exceeded for ${config.url}`);
        Toast.show({
          type: 'error',
          text1: 'Connection Failed',
          text2: 'Unable to reach server after multiple attempts',
          visibilityTime: 4000,
        });
      }
    }

    return Promise.reject(error);
  }
);

export const sendSOS = async (location: { latitude: number; longitude: number }, type?: 'SOS' | 'MEDICAL' | 'FIRE' | 'FLOOD' | 'EARTHQUAKE') => {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    console.log('\n=== Starting SOS Request ===');
    console.log('Auth token present:', !!token);
    
    const requestData = {
      type: 'SOS',
      description: 'Emergency SOS Alert',
      location: { lat: location.latitude, lng: location.longitude },
      priority: 3
    };

  console.log('API URL:', api.defaults.baseURL);
    console.log('Endpoint:', '/api/emergencies');
    console.log('Request Data:', JSON.stringify(requestData, null, 2));
    
    Toast.show({
      type: 'info',
      text1: 'Sending SOS',
      text2: `Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
    });

  const response = await api.post('/api/emergencies/sos', {
      type: type || 'SOS',
      description: type ? `${type} reported via SOS` : 'Emergency SOS Alert',
      location: { lat: location.latitude, lng: location.longitude }
    });
    console.log('SOS Response:', JSON.stringify(response.data, null, 2));

    if (socket.connected) {
      const socketData = {
        location,
        timestamp: new Date().toISOString(),
        emergencyId: response.data.id
      };
      console.log('Emitting socket event sos:triggered:', JSON.stringify(socketData, null, 2));
      socket.emit('sos:triggered', socketData);

      Toast.show({
        type: 'success',
        text1: 'SOS Sent Successfully',
        text2: 'Emergency services have been notified',
      });
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending SOS:', error);
    const errorMessage = error instanceof AxiosError 
      ? error.response?.data?.error || error.message 
      : error instanceof Error 
        ? error.message 
        : 'Failed to send SOS';
    
    Toast.show({
      type: 'error',
      text1: 'SOS Error',
      text2: errorMessage,
    });
    return { success: false, message: errorMessage };
  }
};
