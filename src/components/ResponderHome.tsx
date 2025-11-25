import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator, Image, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { socket } from '../services/socket';
import { api } from '../services/api';
import MapComponent from './MapComponent';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';


export default function ResponderHome({ navigation, token }: any) {
  const [profileName, setProfileName] = useState<string | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any | null>(null);
  const [status, setStatus] = useState<'AVAILABLE' | 'VEHICLE_UNAVAILABLE' | 'ON_DUTY' | 'ARRIVED' | 'RESOLVED'>('AVAILABLE');
  const intervalRef = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [arrivedPressed, setArrivedPressed] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifText, setNotifText] = useState('');
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const RESPONDER_TYPES = ['MEDICAL','FIRE','RESCUE','POLICE'];
  const [responderTypes, setResponderTypes] = useState<string[]>([]);
  const [savingTypes, setSavingTypes] = useState(false);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showingMapPreview, setShowingMapPreview] = useState(false);

  useEffect(() => {
  fetchPending();
  // Only fetch assigned if we've already accepted one
  fetchProfile();
  fetchNotifications();
    // subscribe to socket events for assignment
    try {
      socket.on('emergency:assigned', (em: any) => {
        console.log('Responder: got assigned', em);
        // When first assigned, only show accept modal
        setAssigned(em);
        setAcceptModalVisible(true);
      });
      // update when emergency is changed (ARRIVED, RESOLVED, etc.)
      socket.on('emergency:updated', (em: any) => {
        try {
          if (!em) return;
          console.log('Responder: got emergency:updated', em);
          // Only update if we've already accepted this emergency
          if (assigned && em.id === assigned.id && em.status !== 'IN_PROGRESS') {
            setAssigned(em);
          }
        } catch (e) { console.warn('emergency:updated handler failed', e); }
      });
      socket.on('emergency:arrived', (payload: any) => {
        try {
          console.log('Responder: got emergency:arrived', payload);
          if (assigned && payload && payload.emergencyId === assigned.id) {
            setAssigned((prev: any) => prev ? { ...prev, status: 'ARRIVED' } : prev);
          }
        } catch (e) { console.warn('emergency:arrived handler failed', e); }
      });
    } catch (e) { console.warn('socket sub failed', e); }

    return () => {
      try { socket.off('emergency:assigned'); socket.off('emergency:updated'); socket.off('emergency:arrived'); } catch (e) {}
      stopLocationUpdates();
    };
  }, []);

  const fetchProfile = async () => {
    try {
      const t = await AsyncStorage.getItem('userToken');
  const res = await api.get(`/users/profile`, { headers: { Authorization: `Bearer ${t || token}` } });
      setProfileName(res.data.name || 'Responder');
      try { setResponderTypes(Array.isArray(res.data.responderTypes) ? res.data.responderTypes.map((s:string)=>String(s).toUpperCase()) : []) } catch(e){}
    } catch (err) { console.warn('fetch profile failed', err); }
  };

  const fetchNotifications = async () => {
    try {
      const t = await AsyncStorage.getItem('userToken');
      const res = await api.get(`/notifications`, { headers: { Authorization: `Bearer ${t || token}` } });
      if (res && res.data) {
        setNotifications(res.data);
        // simple unread count: notifications without read flag
        const unread = (res.data || []).filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.warn('fetchNotifications failed', err);
    }
  };

  useEffect(() => {
    // Start location updates only when we have an assignment that is not already ARRIVED
    if (assigned && assigned.status !== 'ARRIVED') startLocationUpdates(assigned.id);
    else stopLocationUpdates();
    // show accept modal if assigned and status is IN_PROGRESS (not yet accepted)
    if (assigned && assigned.status === 'IN_PROGRESS') setAcceptModalVisible(true);
  }, [assigned]);

  const fetchPending = async () => {
    try {
      const t = await AsyncStorage.getItem('userToken');
  const res = await api.get(`/emergencies/pending`, { headers: { Authorization: `Bearer ${t || token}` } });
      setPending(res.data);
    } catch (err) {
      console.error('Failed to fetch pending', err);
    }
  };

  const fetchAssigned = async () => {
    try {
      // naive: find first emergency where responderId === me
      const t = await AsyncStorage.getItem('userToken');
  const profile = await api.get(`/users/profile`, { headers: { Authorization: `Bearer ${t || token}` } });
      const me = profile.data;
  const res = await api.get(`/emergencies`, { headers: { Authorization: `Bearer ${t || token}` } });
      const my = res.data.find((e: any) => e.responderId === me.id && e.status !== 'RESOLVED');
      setAssigned(my || null);
    } catch (err) {
      console.error('Failed to fetch assigned', err);
    }
  };

  const requestAssignment = async (emergencyId: string) => {
    try {
      const t = await AsyncStorage.getItem('userToken');
  const res = await api.post(`/emergencies/request`, { emergencyId }, { headers: { Authorization: `Bearer ${t || token}` } });
      Alert.alert('Requested', 'Request sent to admins');
    } catch (err) {
      console.error('Request assignment failed', err);
      Alert.alert('Error', 'Failed to request assignment');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
    } catch (e) { /* ignore */ }
    try { stopLocationUpdates(); } catch(e) {}
    // navigate to login and reset history
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleMarkFraud = async () => {
    if (!assigned) return Alert.alert('No assignment', 'No assigned emergency to mark as fraud');
    Alert.alert('Confirm', 'Mark this incident as FRAUD? This will flag it for admin review.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Fraud', style: 'destructive', onPress: async () => {
        try {
          const t = await AsyncStorage.getItem('userToken');
          await api.put(`/emergencies/${assigned.id}/mark-fraud`, {}, { headers: { Authorization: `Bearer ${t || token}` } });
          Alert.alert('Marked', 'Emergency flagged as fraud. Admins will review it.');
          try { stopLocationUpdates(); } catch(e) {}
          setAssigned(null);
          setStatus('AVAILABLE');
        } catch (err) {
          console.warn('mark fraud failed', err);
          Alert.alert('Error', 'Failed to mark fraud');
        }
      }}
    ]);
  };

  const selfAssign = async (emergencyId: string) => {
    try {
      // prevent self-assign if already assigned
      if (assigned) {
        return Alert.alert('Already assigned', 'You already have an active assignment.');
      }
      const t = await AsyncStorage.getItem('userToken');
      // get my profile id
      const profile = await api.get(`/users/profile`, { headers: { Authorization: `Bearer ${t || token}` } });
      const me = profile.data;
      if (!me || !me.id) return Alert.alert('Error', 'Unable to determine your user id');
      // call assign endpoint directly (server validates availability)
      const res = await api.post(`/emergencies/assign`, { emergencyId, responderId: me.id }, { headers: { Authorization: `Bearer ${t || token}` } });
      // server returns updated emergency object
      if (res && res.data) {
        setAssigned(res.data);
        setStatus('ON_DUTY');
        setAcceptModalVisible(true);
        Alert.alert('Assigned', 'You have been assigned to this emergency.');
      } else {
        Alert.alert('Assigned', 'Assignment response received.');
      }
    } catch (err: any) {
      console.error('self assign failed', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to self-assign';
      // fallback: send request to admins
      try {
        await requestAssignment(emergencyId);
      } catch (e) { /* ignore */ }
      Alert.alert('Assign Failed', message + '\nA request has been sent to admins.');
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchPending(), fetchAssigned()]);
    setRefreshing(false);
  };

  const startLocationUpdates = async (emergencyId: string) => {
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return;
      // send immediately and then every 10s
      const send = async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const payload = { emergencyId, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
          // emit over socket
          try { socket.emit('responder:location', payload); } catch (e) { console.warn('socket emit failed', e); }
          // also POST to be resilient
          const t = await AsyncStorage.getItem('userToken');
          await api.post(`/emergencies/responder/location`, payload, { headers: { Authorization: `Bearer ${t || token}` } });
        } catch (err) {
          console.warn('send location failed', err);
        }
      };

      send();
      intervalRef.current = setInterval(send, 10000) as any;
    } catch (err) {
      console.warn('startLocationUpdates error', err);
    }
  };

  const stopLocationUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current as any);
      intervalRef.current = null;
    }
  };

  const toggleAvailability = async (newStatus: 'AVAILABLE' | 'VEHICLE_UNAVAILABLE') => {
    try {
      setStatus(newStatus);
      // emit status over socket and persist
      try { socket.emit('responder:status', { status: newStatus }); } catch (e) { console.warn('socket status emit failed', e); }
      const t = await AsyncStorage.getItem('userToken');
  await api.post(`/users/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${t || token}` } });
    } catch (err) {
      console.warn('toggleAvailability error', err);
    }
  };

  const sendNotificationToResident = async (message: string) => {
    if (!assigned || !assigned.user) return Alert.alert('No resident', 'No resident associated with the assigned emergency');
    try {
      const t = await AsyncStorage.getItem('userToken');
  await api.post(`/notifications`, { userId: assigned.user.id, title: 'Message from responder', message }, { headers: { Authorization: `Bearer ${t || token}` } });
      Alert.alert('Sent', 'Notification sent to resident');
    } catch (err) {
      console.error('send notif failed', err);
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  const acceptAssignment = async () => {
    if (!assigned) return Alert.alert('No assignment', 'No assigned emergency to accept');
    setAccepting(true);
    try {
      const t = await AsyncStorage.getItem('userToken');
      const res = await api.post('/emergencies/accept', { emergencyId: assigned.id }, { headers: { Authorization: `Bearer ${t || token}` } });
      if (res && res.data) {
        // After successful accept, set status and close modal
        setStatus('ON_DUTY');
        setAcceptModalVisible(false);
        
        // Then fetch full assignment details and start location updates
        const fullDetails = await api.get(`/emergencies/${assigned.id}`, { headers: { Authorization: `Bearer ${t || token}` } });
        if (fullDetails && fullDetails.data) {
          setAssigned(fullDetails.data);
          Alert.alert('Accepted', 'You have accepted the assignment. Starting location updates.');
          // Location updates will start automatically due to useEffect
        } else {
          setAssigned(res.data); // Fallback to basic data
          Alert.alert('Accepted', 'Assignment accepted with limited details.');
        }
      } else {
        setAcceptModalVisible(false);
        Alert.alert('Warning', 'Accepted but no response data available.');
      }
    } catch (err: any) {
      console.warn('accept failed', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to accept';
      Alert.alert('Accept Failed', message);
      // Reset UI on failure
      setAssigned(null);
      setStatus('AVAILABLE');
    } finally { 
      setAccepting(false);
    }
  };

  // small helper to compute approximate distance (meters) between two {lat,lng}
  const computeDistanceMeters = (a: any, b: any) => {
    if (!a || !b) return null;
    const toRad = (v: number) => v * Math.PI / 180;
    const R = 6371000; // meters
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const aHarv = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1-aHarv));
    return Math.round(R * c);
  };

  const formatDistance = (m: number | null) => {
    if (m === null) return '';
    if (m < 1000) return `${m} m`;
    return `${(m/1000).toFixed(1)} km`;
  };

  return (
    <>
    <View style={styles.container}>
      <LinearGradient colors={['#0f1724', '#112240']} style={styles.header}>
          <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hey {profileName || 'Responder'}</Text>
            <Text style={styles.hint}>Active duty • Respond quickly and stay safe</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={{ marginRight: 12 }} onPress={() => { fetchNotifications(); setNotificationsVisible(true); }}>
              <View>
                <Ionicons name="notifications" size={28} color="#fff" />
                {unreadCount > 0 && (<View style={{ position: 'absolute', right: -4, top: -4, backgroundColor: '#ff3b30', borderRadius: 8, paddingHorizontal: 4 }}><Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>{unreadCount}</Text></View>)}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person-circle" size={42} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={{ marginLeft: 8 }}>
              <Ionicons name="log-out" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

  {/* Weather alert moved to resident Main screen */}

      <View style={styles.urgentContainer}>
        <LinearGradient colors={['#ff5f6d', '#ffc371']} style={styles.urgentBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.urgentText}>URGENT</Text>
              <Text style={styles.urgentSub}>Tap a pending case or open your assigned emergency</Text>
            </View>
          </View>
          <TouchableOpacity onPress={refreshAll} style={styles.urgentAction}>
            {refreshing ? <ActivityIndicator color="#fff" /> : <Ionicons name="refresh" size={18} color="#fff" />}
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Only show assignment section if we have an accepted emergency (not IN_PROGRESS) */}
      {assigned && assigned.status !== 'IN_PROGRESS' && (
        <View style={styles.assignedCardModern}>
          <View style={styles.assignedHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Assignment</Text>
              <Text style={styles.assignedType}>{assigned.type} • {assigned.priority === 3 ? 'HIGH' : assigned.priority === 2 ? 'MEDIUM' : 'LOW'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.assignedDistance}>{assigned.location ? `${formatDistance(computeDistanceMeters(assigned.responderLocation || assigned.location, assigned.location))}` : ''}</Text>
              <View style={[styles.statusPill, assigned.status === 'ARRIVED' ? styles.pillArrived : assigned.status === 'IN_PROGRESS' ? styles.pillOnDuty : styles.pillPending]}>
                <Text style={styles.statusPillText}>{assigned.status === 'ARRIVED' ? 'Arrived' : assigned.status === 'IN_PROGRESS' ? 'Responding' : assigned.status || 'Pending'}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.assignedAddress}>{assigned.address || JSON.stringify(assigned.location)}</Text>
          <Text style={styles.assignedUser}>Resident: {assigned.user?.name} • {assigned.user?.phone}</Text>

          {assigned.responderLocation && (
            <View style={styles.locationRowModern}>
              <Ionicons name="locate" size={20} color="#0b5394" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.locationText}>Responder near {assigned.responderLocation?.place || ''}</Text>
                <Text style={styles.locationCoords}>{`Lat: ${assigned.responderLocation?.lat?.toFixed ? assigned.responderLocation.lat.toFixed(5) : assigned.responderLocation.lat}, Lng: ${assigned.responderLocation?.lng?.toFixed ? assigned.responderLocation.lng.toFixed(5) : assigned.responderLocation.lng}`}</Text>
                <Text style={styles.locationDistance}>≈ {formatDistance(computeDistanceMeters(assigned.responderLocation, assigned.location))} from incident</Text>
              </View>
            </View>
          )}

          <View style={styles.actionsColumn}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('ResponderMap', { emergencyId: assigned.id })}>
              <Ionicons name="map" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Open Map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={arrivedPressed ? styles.positiveBtnArrived : styles.positiveBtnInitial} onPress={async () => {
              if (!assigned) return Alert.alert('No assignment', 'No assigned emergency to mark as arrived');
              try {
                setArriving(true);
                const t = await AsyncStorage.getItem('userToken');
                const res = await api.post(`/emergencies/arrive`, { emergencyId: assigned.id }, { headers: { Authorization: `Bearer ${t || token}` } });
                if (res && res.data && res.data.id) {
                  setAssigned(res.data);
                  setStatus(res.data.status || 'ARRIVED');
                  try { stopLocationUpdates(); } catch(e) {}
                  // mark button as pressed so it turns green and becomes disabled
                  setArrivedPressed(true);
                  Alert.alert('Arrived', 'You have marked arrival to the scene.');
                } else {
                  try { stopLocationUpdates(); } catch(e) {}
                  setArrivedPressed(true);
                  Alert.alert('Arrived', 'You have marked arrival to the scene.');
                }
              } catch (err: any) {
                console.warn('arrive failed', err);
                let errorMsg = 'Failed to mark arrival';
                if (err?.response?.data) {
                  errorMsg += `\n${JSON.stringify(err.response.data)}`;
                } else if (err?.message) {
                  errorMsg += `\n${err.message}`;
                }
                Alert.alert('Error', errorMsg);
              } finally { setArriving(false); }
            }} disabled={arriving || arrivedPressed}>
              <Ionicons name="checkmark-done" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>{arriving ? 'Marking...' : 'Arrived'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('EmergencyTracker', { emergencyId: assigned.id })}>
              <Text style={styles.ghostText}>History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setNotifModalVisible(true)}>
              <Text style={styles.ghostText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: '#8b0000', marginVertical: 8 }]} onPress={handleMarkFraud}>
              <Ionicons name="alert" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Mark Fraud</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerBtn} onPress={async () => {
              try {
                const t = await AsyncStorage.getItem('userToken');
                await api.post(`/emergencies/resolve`, { emergencyId: assigned.id }, { headers: { Authorization: `Bearer ${t || token}` } });
                Alert.alert('Resolved', 'Marked as resolved');
                setAssigned(null);
                setStatus('AVAILABLE');
              } catch (err) {
                console.warn('resolve failed', err);
                Alert.alert('Error', 'Failed to mark resolved');
              }
            }}>
              <Ionicons name="flag" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Resolve</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Show message when no accepted assignment */}
      {(!assigned || assigned.status === 'IN_PROGRESS') && (
        <View style={[styles.assignedCard, { paddingVertical: 12 }]}>
          <Text style={styles.sectionTitle}>Your Assignment</Text>
          <Text style={{ color: '#777' }}>No current assignment — check pending emergencies</Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 8 }]} onPress={refreshAll}>
            {refreshing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Refresh</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>Pending Emergencies</Text>
          <TouchableOpacity onPress={refreshAll}><Text style={{ color: '#1a73e8', fontWeight: '700' }}>Refresh</Text></TouchableOpacity>
        </View>
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.item, item.priority === 3 ? styles.highPriority : item.priority === 2 ? styles.medPriority : {}]} onPress={() => requestAssignment(item.id)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.itemTitle}>🚑 {item.type}</Text>
                <Text style={{ fontWeight: '700', color: item.priority === 3 ? '#b71c1c' : '#333' }}>{item.priority === 3 ? 'HIGH' : item.priority === 2 ? 'MED' : 'LOW'}</Text>
              </View>
              <Text style={{ color: '#444' }}>{item.address || JSON.stringify(item.location)}</Text>
              <Text style={{ color: '#666', marginTop: 6 }}>Reported by: {item.user?.name}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ alignItems: 'center', paddingRight: 16 }}>
                {assigned ? (
                  <TouchableOpacity style={styles.btnAlt} onPress={() => navigation.navigate('ResponderMap', { emergencyId: item.id })}>
                    <Text style={{ color: '#1a73e8', fontWeight: '700' }}>Open Map</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.primarySmallBtn} onPress={() => selfAssign(item.id)}>
                      <Text style={styles.primarySmallText}>Take</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostSmallBtn} onPress={() => requestAssignment(item.id)}>
                      <Text style={styles.ghostSmallText}>Request</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostSmallBtn} onPress={() => navigation.navigate('ResponderMap', { emergencyId: item.id })}>
                      <Text style={styles.ghostSmallText}>Open Map</Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </TouchableOpacity>
          )}
        />
      </View>

  <View style={styles.footer}>
        <TouchableOpacity style={[styles.chip, status === 'AVAILABLE' ? styles.chipActive : {}]} onPress={() => toggleAvailability('AVAILABLE')}>
          <Text style={{ color: status === 'AVAILABLE' ? '#fff' : '#333', fontWeight: '700' }}>Available</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, status === 'VEHICLE_UNAVAILABLE' ? styles.chipActive : {}]} onPress={() => toggleAvailability('VEHICLE_UNAVAILABLE')}>
          <Text style={{ color: status === 'VEHICLE_UNAVAILABLE' ? '#fff' : '#333', fontWeight: '700' }}>Vehicle Unavailable</Text>
        </TouchableOpacity>
      </View>

      {/* Responder Types selector */}
      <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12, margin: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Responder Types</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RESPONDER_TYPES.map((t) => {
            const active = responderTypes.includes(t);
            return (
              <TouchableOpacity key={t} onPress={() => {
                if (active) setResponderTypes(prev => prev.filter(x => x !== t));
                else setResponderTypes(prev => [...prev, t]);
              }} style={[styles.chip, active ? styles.chipActive : {}, { marginRight: 8, marginBottom: 8 }]}>
                <Text style={{ color: active ? '#fff' : '#333', fontWeight: '700' }}>{t}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <TouchableOpacity style={[styles.modalBtn, { marginRight: 8 }]} onPress={() => { setResponderTypes([]); }}>
            <Text>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalPrimary, { paddingHorizontal: 12 }]} onPress={async () => {
            try {
              setSavingTypes(true);
              const tkn = await AsyncStorage.getItem('userToken');
              await api.patch('/users/profile', { responderTypes }, { headers: { Authorization: `Bearer ${tkn || token}` } });
              Alert.alert('Saved', 'Responder types updated');
            } catch (e) {
              console.warn('save responder types failed', e);
              Alert.alert('Error', 'Failed to save responder types');
            } finally { setSavingTypes(false); }
          }}>
            {savingTypes ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>

  </View>

  <Modal visible={notifModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Message Resident</Text>
            <TextInput value={notifText} onChangeText={setNotifText} placeholder="Type a short message" style={styles.modalInput} />
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)} style={styles.modalBtn}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={async () => { await sendNotificationToResident(notifText); setNotifText(''); setNotifModalVisible(false); }} style={[styles.modalBtn, styles.modalPrimary]}><Text style={{ color:'#fff' }}>Send</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={notificationsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <ScrollView style={{ marginBottom: 12 }}>
              {notifications && notifications.length > 0 ? notifications.map((n: any) => (
                <View key={n.id || JSON.stringify(n)} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text style={{ fontWeight: '700' }}>{n.title || n.type}</Text>
                  <Text style={{ color: '#666' }}>{n.message || JSON.stringify(n.data)}</Text>
                  <Text style={{ color:'#999', fontSize:11, marginTop:6 }}>{new Date(n.createdAt || n.created_at || Date.now()).toLocaleString()}</Text>
                </View>
              )) : (
                <Text style={{ color: '#666' }}>No notifications</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => { setNotificationsVisible(false); }} style={styles.modalBtn}><Text>Close</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={acceptModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.acceptCard}>
            <View style={styles.acceptHeader}>
              <View>
                <Text style={styles.acceptTitle}>New Emergency Assignment</Text>
                {assigned && (
                  <Text style={styles.acceptSubtitle}>{assigned.type} • {assigned.priority === 3 ? 'HIGH' : assigned.priority === 2 ? 'MEDIUM' : 'LOW'}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setAcceptModalVisible(false)} style={{ padding:8 }}>
                <Text style={{ color:'#666' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {assigned && (
              <>
                <View style={{ height:220, marginBottom:12, borderRadius:12, overflow:'hidden' }}>
                  <MapComponent
                    centers={[]}
                    userLocation={null}
                    initialRegion={{
                      latitude: assigned.location.lat,
                      longitude: assigned.location.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01
                    }}
                  />
                </View>
                
                <View style={{ marginBottom:16 }}>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Emergency Details</Text>
                  <Text style={{ color:'#333' }}>{assigned.description || 'No description provided'}</Text>
                  <Text style={{ color:'#666', marginTop:8 }}>📍 {assigned.address || `${assigned.location.lat.toFixed(5)}, ${assigned.location.lng.toFixed(5)}`}</Text>
                  {assigned.user && (
                    <Text style={{ color:'#666', marginTop:6 }}>👤 Reported by: {assigned.user.name || assigned.user.email}</Text>
                  )}
                </View>

                <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:8 }}>
                  <TouchableOpacity 
                    onPress={() => setAcceptModalVisible(false)}
                    style={styles.declineBtn}
                  >
                    <Text style={{ color:'#333' }}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={acceptAssignment}
                    style={[styles.acceptBtn, accepting ? { opacity: 0.7 } : {}]}
                    disabled={accepting}
                  >
                    <Text style={{ color:'#fff', fontWeight:'700' }}>{accepting ? 'Accepting...' : 'Accept & Respond'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f8fb' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 4, color: '#666' },
  header: { padding: 18, borderRadius: 12, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  hint: { color: '#666', marginTop: 4 },
  profileBtn: { justifyContent: 'center', alignItems: 'center' },
  urgentContainer: { marginBottom: 12 },
  urgentBanner: { padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  urgentText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  urgentSub: { color: '#fff', fontSize: 12 },
  urgentAction: { padding: 8 },
  assignedCardModern: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width:0, height:6 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  assignedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  assignedType: { fontWeight: '800', color: '#111' },
  assignedAddress: { color: '#444', marginTop: 6 },
  assignedUser: { color: '#666', marginTop: 6 },
  assignedDistance: { color: '#666', fontSize: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  item: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8, backgroundColor: '#fff' },
  highPriority: { borderColor: '#b71c1c', backgroundColor: '#fff5f5' },
  medPriority: { borderColor: '#ff9800', backgroundColor: '#fffaf0' },
  itemTitle: { fontWeight: '700' },
  primaryBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  // Arrive button styles: initial (yellow) and pressed (green/disabled)
  positiveBtnInitial: { backgroundColor: '#f59e0b', padding: 12, borderRadius: 10, marginRight: 12, flexDirection: 'row', alignItems: 'center' },
  positiveBtnArrived: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 10, marginRight: 12, flexDirection: 'row', alignItems: 'center', opacity: 0.9 },
  // Legacy alias
  positiveBtn: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 10, marginRight: 12, flexDirection: 'row', alignItems: 'center' },
  dangerBtn: { backgroundColor: '#d32f2f', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  primarySmallBtn: { backgroundColor: '#1a73e8', padding: 8, borderRadius: 8, marginRight: 12 },
  primarySmallText: { color: '#fff', fontWeight: '700' },
  ghostSmallBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth:1, borderColor:'#eee', marginRight: 12 },
  ghostSmallText: { color: '#1a73e8', fontWeight: '700' },
  ghostBtn: { backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginRight: 12 },
  ghostText: { color: '#1a73e8', fontWeight: '700' },
  // legacy buttons (compat)
  btn: { backgroundColor: '#1a73e8', padding: 8, borderRadius: 6, marginRight: 8 },
  btnAlt: { backgroundColor: '#eee', padding: 8, borderRadius: 6, marginRight: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  btnText: { color: '#fff', fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  statusBtn: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  locationRowModern: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 12, backgroundColor: '#f1f6ff', borderRadius: 10 },
  locationIcon: { fontSize: 20, marginRight: 8 },
  locationText: { fontWeight: '700', color: '#0b5394' },
  locationCoords: { color: '#3b3b3b', marginTop: 2, fontSize: 12 },
  locationDistance: { color: '#666', marginTop: 4, fontSize: 12 },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, marginTop: 6 },
  pillOnDuty: { backgroundColor: '#e6f4ea' },
  pillArrived: { backgroundColor: '#dff0e3' },
  pillPending: { backgroundColor: '#fff8e6' },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#134e4a' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  actionsScrollView: { marginTop: 12 },
  actionsContainer: { alignItems: 'center', paddingRight: 16 },
  actionsColumn: { marginTop: 12, flexDirection: 'column', alignItems: 'flex-start' },
  assignedCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 12, backgroundColor: '#fff' },
  // modal styles
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  modalCard: { width:'90%', backgroundColor:'#fff', padding:16, borderRadius:12 },
  modalTitle: { fontWeight:'800', marginBottom:8 },
  modalInput: { borderWidth:1, borderColor:'#eee', padding:10, borderRadius:8, marginBottom:12 },
  modalBtn: { padding:10 },
  modalPrimary: { backgroundColor:'#1a73e8', borderRadius:8, paddingHorizontal:12 },
  // accept modal
  acceptCard: { width:'95%', backgroundColor:'#fff', padding:16, borderRadius:12 },
  acceptHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  acceptTitle: { fontSize:18, fontWeight:'800' },
  acceptSubtitle: { color:'#666', marginTop:4 },
  declineBtn: { padding:10, borderWidth:1, borderColor:'#eee', borderRadius:8, marginRight:8 },
  acceptBtn: { padding:10, backgroundColor:'#1a73e8', borderRadius:8 },
  // end styles
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#134e4a' }
});
