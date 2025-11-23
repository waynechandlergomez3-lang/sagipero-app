import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import MapComponent from './MapComponent';
import { socket } from '../services/socket';
import { api } from '../services/api';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EmergencyTracker({ route, navigation }: any) {
  const { emergencyId } = route.params || {};
  const [responderLocation, setResponderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [history, setHistory] = useState<any[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  useEffect(() => {
    // Fetch initial emergency state from backend
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          console.log('EmergencyTracker: no token in AsyncStorage');
          return;
        }
  let res;
  if (emergencyId) res = await api.get(`/emergencies/${emergencyId}`, { headers: { Authorization: `Bearer ${token}` } });
  else res = await api.get(`/emergencies/latest`, { headers: { Authorization: `Bearer ${token}` } });
        console.log('EmergencyTracker: fetch response status=', res.status);
        console.log('EmergencyTracker: fetch response data=', res.data);
        if (res.data) {
          console.log('EmergencyTracker: setting status to', res.data.status || 'PENDING');
          setStatus(res.data.status || 'PENDING');
          
          // Handle responderLocation from different possible sources
          let respLoc = null;
          if (res.data.responderLocation) {
            respLoc = res.data.responderLocation;
          } else if (res.data.User_Emergency_responderIdToUser?.responderLocation) {
            respLoc = res.data.User_Emergency_responderIdToUser.responderLocation;
          }
          
          if (respLoc) {
            console.log('EmergencyTracker: setting responderLocation to', respLoc);
            // Ensure the location has the correct format {lat, lng}
            const formattedLoc = {
              lat: respLoc.lat || respLoc.latitude,
              lng: respLoc.lng || respLoc.longitude
            };
            setResponderLocation(formattedLoc);
          }
        }
      } catch (e) {
        // if the fetch by id returned 404, try the latest endpoint as fallback
  if (e && (e as any).response && (e as any).response.status === 404 && emergencyId) {
          try {
            console.log('EmergencyTracker: requested id not found, falling back to /latest');
            const token = await AsyncStorage.getItem('userToken');
            if (!token) return;
            const res2 = await api.get(`/emergencies/latest`, { headers: { Authorization: `Bearer ${token}` } });
            console.log('EmergencyTracker: fallback fetch response data=', res2.data);
            if (res2.data) {
              setStatus(res2.data.status || 'PENDING');
              
              // Handle responderLocation from different possible sources
              let respLoc = null;
              if (res2.data.responderLocation) {
                respLoc = res2.data.responderLocation;
              } else if (res2.data.User_Emergency_responderIdToUser?.responderLocation) {
                respLoc = res2.data.User_Emergency_responderIdToUser.responderLocation;
              }
              
              if (respLoc) {
                console.log('EmergencyTracker fallback: setting responderLocation to', respLoc);
                const formattedLoc = {
                  lat: respLoc.lat || respLoc.latitude,
                  lng: respLoc.lng || respLoc.longitude
                };
                setResponderLocation(formattedLoc);
              }
            }
            return;
          } catch (err2) {
            console.warn('EmergencyTracker: fallback /latest also failed', err2);
            return;
          }
        }
        console.warn('Failed to fetch emergency initial state', e);
      }
    })();
    // Subscribe to responder location updates for this emergency
    try {
      console.log('EmergencyTracker: subscribing to emergency:responderLocation socket events');
      socket.on('emergency:responderLocation', (payload: any) => {
        console.log('EmergencyTracker: socket payload received', payload);
        if (!payload) return;
        // if we have an emergencyId param, only apply updates for that emergency
        if (emergencyId && payload.emergencyId !== emergencyId) {
          console.log('EmergencyTracker: socket payload emergencyId does not match current emergencyId', payload.emergencyId);
          return;
        }
        if (payload.location) {
          console.log('EmergencyTracker: updating responderLocation from socket to', payload.location);
          // Ensure consistent location format
          const formattedLoc = {
            lat: payload.location.lat || payload.location.latitude,
            lng: payload.location.lng || payload.location.longitude
          };
          setResponderLocation(formattedLoc);
        }
        if (payload.status) {
          console.log('EmergencyTracker: updating status from socket to', payload.status);
          setStatus(payload.status);
        } else {
          // default to IN_PROGRESS when location update arrives
          setStatus('IN_PROGRESS');
        }
        // append history messages when socket carries event-like payloads
        if (payload.eventType || payload.arrivedAt || payload.ts) {
          setHistory(h => {
            const entry = { event_type: payload.eventType || (payload.arrivedAt ? 'ARRIVED' : (payload.ts ? 'RESPONDER_LOCATION' : 'UPDATE')), payload: payload, created_at: new Date().toISOString() };
            return [...h, entry];
          });
        }
      });
      // listen for accept events so residents see ACCEPTED in their timeline
      socket.on('emergency:accepted', (payload: any) => {
        if (!payload) return;
        if (emergencyId && payload.emergencyId !== emergencyId) return;
        // add ACCEPTED entry and update status
        setStatus('ACCEPTED');
        setHistory(h => {
          const entry = { event_type: 'ACCEPTED', payload, created_at: new Date().toISOString() };
          return [...h, entry];
        });
      });
    } catch (e) {
      console.warn('socket subscribe failed', e);
    }

    // get current position to show on map
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch (err) {
        console.warn('Failed to get location for EmergencyTracker', err);
      }
    })();

    return () => {
      try { socket.off('emergency:responderLocation'); } catch (e) {}
    };
  }, [emergencyId]);

  useEffect(() => {
    // fetch history on mount
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
        let idToUse = emergencyId;
        if (!idToUse) {
          // try to get the latest emergency for this user
          try {
            const latest = await api.get(`/emergencies/latest`, { headers: { Authorization: `Bearer ${token}` } });
            if (latest?.data?.id) idToUse = latest.data.id;
          } catch (e) {
            // ignore, we'll attempt to fetch by provided id only
          }
        }
        if (!idToUse) return;
        const res = await api.get(`/emergencies/${idToUse}/history`, { headers: { Authorization: `Bearer ${token}` } });
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.warn('Failed to fetch emergency history', err);
      }
    })();
    // listen for arrived events specifically
    try {
      socket.on('emergency:arrived', async (payload: any) => {
        if (!payload) return;
        // if emergencyId param provided, ensure match
        if (emergencyId && payload.emergencyId !== emergencyId) return;
        // set status and avoid adding duplicate ARRIVED entries
        setStatus('ARRIVED');
        setHistory(h => {
          const hasArrived = h.some(item => (item.event_type||'').toUpperCase() === 'ARRIVED');
          if (hasArrived) return h;
          return [...h, { event_type: 'ARRIVED', payload, created_at: payload.arrivedAt || new Date().toISOString() }];
        });
        // re-fetch authoritative history from server to ensure resident sees full history
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (token) {
            const idToUse = emergencyId || payload.emergencyId;
            if (idToUse) {
              const res = await api.get(`/emergencies/${idToUse}/history`, { headers: { Authorization: `Bearer ${token}` } });
              setHistory(Array.isArray(res.data) ? res.data : []);
            }
          }
        } catch (e) { console.warn('Failed to re-fetch history after arrived', e); }
      });
    } catch (e) { console.warn('socket subscribe arrived failed', e); }
    return () => { try { socket.off('emergency:arrived'); } catch(e) {} };
  }, [emergencyId]);

  // Poll emergency and history periodically (every 3s) while screen is mounted
  useEffect(() => {
    let iv: any = null;
    const startPolling = () => {
      iv = setInterval(async () => {
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (!token) return;
          let idToUse = emergencyId;
          if (!idToUse) {
            try {
              const latest = await api.get('/emergencies/latest', { headers: { Authorization: `Bearer ${token}` } });
              if (latest?.data?.id) idToUse = latest.data.id;
            } catch (e) { /* ignore */ }
          }
          if (!idToUse) return;
          // fetch emergency and update UI
          try {
            const er = await api.get(`/emergencies/${idToUse}`, { headers: { Authorization: `Bearer ${token}` } });
            if (er?.data) {
              const newStatus = er.data.status || 'PENDING';
              setStatus(prev => {
                // once ARRIVED or RESOLVED, keep it and stop polling
                if ((prev||'').toUpperCase() === 'ARRIVED' || (prev||'').toUpperCase() === 'RESOLVED') return prev;
                return newStatus;
              });
              // Handle responderLocation from polling
              if (er.data.responderLocation) {
                console.log('EmergencyTracker polling: found responderLocation', er.data.responderLocation);
                const formattedLoc = {
                  lat: er.data.responderLocation.lat || er.data.responderLocation.latitude,
                  lng: er.data.responderLocation.lng || er.data.responderLocation.longitude
                };
                setResponderLocation(formattedLoc);
              }
              // if emergency is arrived or resolved, stop polling early
              if ((er.data.status||'').toUpperCase() === 'ARRIVED' || (er.data.status||'').toUpperCase() === 'RESOLVED') {
                if (iv) { clearInterval(iv); iv = null; }
              }
            }
          } catch (e) { /* ignore missing */ }
          // fetch history unless we've reached ARRIVED/RESOLVED
          try {
            const rh = await api.get(`/emergencies/${idToUse}/history`, { headers: { Authorization: `Bearer ${token}` } });
            const newHistory = Array.isArray(rh.data) ? rh.data : [];
            // dedupe ARRIVED entries: prefer server authoritative history
            setHistory(prev => {
              // if prev already contains ARRIVED but server doesn't, prefer server
              return newHistory;
            });
          } catch (e) { /* ignore */ }
        } catch (err) {
          console.warn('EmergencyTracker polling error', err);
        }
      }, 3000);
    };
    startPolling();
    return () => { if (iv) clearInterval(iv); };
  }, [emergencyId]);

  const initialRegion = { latitude: userLocation?.latitude || 14.5995, longitude: userLocation?.longitude || 120.9842, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Responder Status</Text>
        <Text style={styles.status}>{status.replace('_',' ')}</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapComponent centers={[]} userLocation={userLocation} initialRegion={initialRegion} responderLocation={responderLocation} />
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.centerButton} onPress={() => {
          if (!responderLocation) return Alert.alert('No location', 'Responder location not available yet.');
          // inject JS to center on responder
          try {
            // send message via socket to the map or call a method on WebView via ref - MapComponent does not expose ref, so we navigate user to center by re-rendering
            Alert.alert('Center', 'Tap the 📍 button on the map to center on your location.');
          } catch (e) {
            console.warn('Center on responder failed', e);
          }
        }}>
          <Text style={styles.centerText}>See responder location</Text>
        </TouchableOpacity>
        <View style={{ marginTop: 12 }}>
          <TouchableOpacity onPress={() => setHistoryCollapsed(h => !h)} style={{ marginBottom: 8 }}>
            <Text style={{ color: '#1a73e8', fontWeight: '700' }}>{historyCollapsed ? 'Show history' : 'Hide history'}</Text>
          </TouchableOpacity>
          {!historyCollapsed && (
            <>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>History</Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
                {history.length === 0 ? <Text style={{ color: '#666' }}>No history yet</Text> : history.slice().reverse().map((h, idx) => (
                <View key={idx} style={{ padding: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 6, marginBottom: 6 }}>
                  <Text style={{ fontWeight: '700' }}>{h.event_type}</Text>
              {(() => {
                try {
                  switch((h.event_type||'').toUpperCase()){
                    case 'CREATED': {
                      const who = h.payload?.user?.name || h.payload?.userId || 'Resident'
                      return <Text style={{ color: '#444', marginTop: 4 }}>Reported by {who}</Text>
                    }
                    case 'ASSIGNED': {
                      const who = h.payload?.responderName || h.payload?.responderId || 'Responder'
                      return <Text style={{ color: '#444', marginTop: 4 }}>Assigned to {who}</Text>
                    }
                    case 'ACCEPTED': {
                      const who = h.payload?.responderName || h.payload?.responderId || 'Responder'
                      const at = h.payload?.acceptedAt || h.payload?.ts || h.created_at
                      return <Text style={{ color: '#444', marginTop: 4 }}>Responder {who} accepted at {new Date(at).toLocaleString()}</Text>
                    }
                    case 'ARRIVED': {
                      const who = h.payload?.responderName || h.payload?.responderId || 'Responder'
                      const at = h.payload?.arrivedAt || h.payload?.ts || h.created_at
                      return <Text style={{ color: '#444', marginTop: 4 }}>Responder {who} arrived at {new Date(at).toLocaleString()}</Text>
                    }
                    case 'RESPONDER_LOCATION': {
                      const loc = h.payload?.location || h.payload
                      const lat = loc?.lat || loc?.latitude || (loc?.coords && loc.coords.latitude)
                      const lng = loc?.lng || loc?.longitude || (loc?.coords && loc.coords.longitude)
                      if(lat && lng) return <Text style={{ color: '#444', marginTop: 4 }}>Responder at {lat.toFixed(6)},{lng.toFixed(6)}</Text>
                      return <Text style={{ color: '#444', marginTop: 4 }}>{JSON.stringify(h.payload)}</Text>
                    }
                    default: return <Text style={{ color: '#444', marginTop: 4 }}>{JSON.stringify(h.payload)}</Text>
                  }
                } catch (e) { return <Text style={{ color: '#444', marginTop: 4 }}>{JSON.stringify(h.payload)}</Text> }
              })()}
                  <Text style={{ color: '#999', marginTop: 6 }}>{new Date(h.created_at).toLocaleString()}</Text>
                </View>
              ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700' },
  status: { marginTop: 4, color: '#FF5722', fontWeight: '700' },
  mapContainer: { flex: 1 },
  controls: { padding: 16 },
  centerButton: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 8, alignItems: 'center' },
  centerText: { color: '#fff', fontWeight: '700' }
});
