// Environment-aware configuration
// This file automatically switches between development and production configs

// Environment detection - __DEV__ is React Native global
const isProduction = __DEV__ === false;

// Configuration constants
const PRODUCTION_CONFIG = {
  API_BASE: 'https://sagipero-backend-production.up.railway.app',
  SOCKET_BASE: 'https://sagipero-backend-production.up.railway.app',
  API_HOST: 'https://sagipero-backend-production.up.railway.app'
};

const DEVELOPMENT_CONFIG = {
  API_BASE: 'http://192.168.1.7:8080',
  SOCKET_BASE: 'http://192.168.1.7:8080',
  API_HOST: 'http://192.168.1.7:8080'
};

// Select configuration based on environment
const CONFIG = isProduction ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;

if (isProduction) {
  console.log('🚀 Loading PRODUCTION configuration (Railway backend)');
} else {
  console.log('🔧 Loading DEVELOPMENT configuration (localhost)');
}

// Export the selected configuration
export const API_BASE = CONFIG.API_BASE;
export const SOCKET_BASE = CONFIG.SOCKET_BASE;
export const API_HOST = CONFIG.API_HOST;

// Export environment info for debugging
export const ENV_INFO = {
  isProduction,
  isDevelopment: !isProduction,
  API_BASE: CONFIG.API_BASE,
  SOCKET_BASE: CONFIG.SOCKET_BASE,
  API_HOST: CONFIG.API_HOST
};

console.log('📱 Mobile App Environment:', ENV_INFO);
