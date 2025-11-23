// Development configuration (localhost)
export const API_BASE = 'http://192.168.1.7:8080'
export const SOCKET_BASE = 'http://192.168.1.7:8080'
export const API_HOST = 'http://192.168.1.7:8080'

// Environment detection
export const isProduction = __DEV__ === false
export const isDevelopment = __DEV__ === true

console.log('Using development configuration:', {
  API_BASE,
  SOCKET_BASE,
  API_HOST,
  isProduction,
  isDevelopment
})