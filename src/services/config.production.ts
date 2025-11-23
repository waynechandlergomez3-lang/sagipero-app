// Production configuration for Railway backend
export const API_BASE = 'https://sagipero-backend-production.up.railway.app'
export const SOCKET_BASE = 'https://sagipero-backend-production.up.railway.app'
export const API_HOST = 'https://sagipero-backend-production.up.railway.app'

// Environment detection
export const isProduction = __DEV__ === false
export const isDevelopment = __DEV__ === true

console.log('Using production configuration:', {
  API_BASE,
  SOCKET_BASE,
  API_HOST,
  isProduction,
  isDevelopment
})