import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_BASE } from './config';

let SOCKET_URL = typeof SOCKET_BASE !== 'undefined' ? SOCKET_BASE : 'http://localhost:8080'; // Socket URL (not /api)

export let socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  timeout: 10000,
  transports: ['websocket'],
  path: '/socket.io'
});

export const getSocket = () => socket

export const setSocketBase = (base: string) => {
  try {
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
    }
  } catch (e) { /* ignore */ }
  SOCKET_URL = base
  socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    timeout: 10000,
    transports: ['websocket'],
    path: '/socket.io'
  })
  console.log('Socket base updated to', SOCKET_URL)
  return socket
}

// Setup socket event handlers
socket.on('connect', () => {
  console.log('Connected to socket server');
});

socket.on('disconnect', (reason) => {
  console.log('Socket Disconnected:', reason);
  
  // Attempt to reconnect if disconnected due to transport error
  if (reason === 'transport error' || reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
  
  // If auth fails, token might be invalid
  if (error.message === 'auth failed') {
    AsyncStorage.removeItem('userToken');
  }
});

socket.on('error', (error) => {
  console.error('Socket Error:', error);
});

export const initializeSocket = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.error('No auth token found');
      return;
    }

    // Set auth token before connecting
    socket.auth = { token };
    
    // Ensure we're not already connected before trying to connect
    if (!socket.connected) {
      socket.connect();
    }
    
  } catch (error) {
    console.error('Error initializing socket:', error);
  }
};
