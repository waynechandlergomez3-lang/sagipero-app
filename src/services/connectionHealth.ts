import { api } from './api';
import Toast from 'react-native-toast-message';
import { ENV_INFO } from './config';

interface ConnectionStatus {
  isConnected: boolean;
  backendUrl: string;
  environment: string;
  lastChecked: string;
  responseTime?: number;
}

let connectionStatus: ConnectionStatus = {
  isConnected: false,
  backendUrl: ENV_INFO.API_BASE,
  environment: ENV_INFO.isProduction ? 'production' : 'development',
  lastChecked: new Date().toISOString()
};

export const checkBackendConnection = async (): Promise<ConnectionStatus> => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Checking backend connection...');
    console.log('Environment:', ENV_INFO.isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
    console.log('Backend URL:', ENV_INFO.API_BASE);
    
    const response = await api.get('/health', { timeout: 10000 });
    const responseTime = Date.now() - startTime;
    
    connectionStatus = {
      isConnected: true,
      backendUrl: ENV_INFO.API_BASE,
      environment: ENV_INFO.isProduction ? 'production' : 'development',
      lastChecked: new Date().toISOString(),
      responseTime
    };
    
    console.log('✅ Backend connection successful');
    console.log(`⚡ Response time: ${responseTime}ms`);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return connectionStatus;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    connectionStatus = {
      isConnected: false,
      backendUrl: ENV_INFO.API_BASE,
      environment: ENV_INFO.isProduction ? 'production' : 'development',
      lastChecked: new Date().toISOString(),
      responseTime
    };
    
    console.error('❌ Backend connection failed');
    console.error('Error:', error.message);
    console.error('Response time:', responseTime + 'ms');
    
    // More detailed error logging for different scenarios
    if (!error.response) {
      console.error('🌐 Network error - cannot reach backend');
      if (ENV_INFO.isProduction) {
        console.error('🚨 Production backend unreachable:', ENV_INFO.API_BASE);
      } else {
        console.error('🔧 Development backend unreachable:', ENV_INFO.API_BASE);
        console.error('💡 Make sure backend server is running locally');
      }
    } else {
      console.error('🔥 Backend responded with error:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return connectionStatus;
  }
};

export const showConnectionStatus = async (): Promise<void> => {
  const status = await checkBackendConnection();
  
  if (status.isConnected) {
    Toast.show({
      type: 'success',
      text1: 'Backend Connected',
      text2: `${status.environment.toUpperCase()} (${status.responseTime}ms)`,
      visibilityTime: 3000,
    });
  } else {
    Toast.show({
      type: 'error',
      text1: 'Backend Disconnected',
      text2: `Cannot reach ${status.environment.toUpperCase()} backend`,
      visibilityTime: 5000,
    });
  }
};

export const getConnectionStatus = (): ConnectionStatus => {
  return connectionStatus;
};

// Auto-check connection on module load
checkBackendConnection().catch(() => {
  // Silent fail on initial check
});

export default {
  checkBackendConnection,
  showConnectionStatus,
  getConnectionStatus
};