import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Modal, TextInput } from 'react-native';
import WebView from 'react-native-webview';
import axios from 'axios';
import { api } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';



export default function ResponderMap({ route, navigation }: any) {
  const { emergencyId } = route.params || {};
  const webRef = useRef<WebView>(null);
  const [webReady, setWebReady] = useState(false);
  const [responderLoc, setResponderLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencyLoc, setEmergencyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<any>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);
  const [watcherInterval, setWatcherInterval] = useState<number | null>(null);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifText, setNotifText] = useState('');

  useEffect(() => {
    if (emergencyId) fetchEmergency();
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setResponderLoc(loc);
      } catch (e) {
        console.warn('Failed get location', e);
      }
    })();

    return () => {
      // cleanup watcher
      if (watcherInterval) clearInterval(watcherInterval as any);
    };
  }, [emergencyId]);

  useEffect(() => {
    if (!webReady) return;
    if (responderLoc) {
      inject(`updateResponderLocation(${responderLoc.lat}, ${responderLoc.lng});`);
    }
    if (emergencyLoc) {
      inject(`setTargetLocation(${emergencyLoc.lat}, ${emergencyLoc.lng});`);
    }
    if (responderLoc && emergencyLoc) {
      // ask webview to compute route
      inject(`computeRoute(${responderLoc.lng}, ${responderLoc.lat}, ${emergencyLoc.lng}, ${emergencyLoc.lat});`);
    }
  }, [webReady, responderLoc, emergencyLoc]);

  // start periodic watcher when web is ready
  useEffect(() => {
    if (!webReady || !emergencyId) return;
    const start = async () => {
      // immediately send
      await sendLocationUpdate();
      const id = setInterval(() => { sendLocationUpdate(); }, 5000) as any;
      setWatcherInterval(id);
    };
    start();
    return () => { if (watcherInterval) clearInterval(watcherInterval as any); };
  }, [webReady, emergencyId]);

  const sendLocationUpdate = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setResponderLoc(loc);
      const payload = { emergencyId, location: loc };
      try { (window as any).__socket?.emit('responder:location', payload); } catch (e) { /* socket fallback if service not initialized */ }
      const token = await AsyncStorage.getItem('userToken');
  await api.post(`/emergencies/responder/location`, payload, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn('send location update failed', err);
    }
  };

  const fetchEmergency = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
  const res = await api.get(`/emergencies/${emergencyId}`, { headers: { Authorization: `Bearer ${token}` } });
      setEmergencyInfo(res.data);
      if (res.data && res.data.location) {
        const loc = res.data.location;
        setEmergencyLoc({ lat: loc.lat, lng: loc.lng });
      }
    } catch (err) {
      console.error('Failed fetch emergency', err);
      Alert.alert('Error', 'Unable to fetch emergency info');
    }
  };

  const inject = (js: string) => {
    try {
      webRef.current?.injectJavaScript(`(function(){try{${js}}catch(e){console.error(e);} })();true;`);
    } catch (e) {
      console.warn('inject failed', e);
    }
  };

  const onMessage = (e: any) => {
    const data = e.nativeEvent.data;
    console.log('ResponderMap webmsg', data);
    // expect route-related messages optionally JSON — parse for ETA/distance if sent
    try {
      if (typeof data === 'string' && data.startsWith('route-info:')) {
        const payload = JSON.parse(data.replace('route-info:', ''));
        if (payload.duration) setEta(`${Math.round(payload.duration/60)} min`);
        if (payload.distance) setDistanceText(`${(payload.distance/1000).toFixed(1)} km`);
      }
    } catch (err) { console.warn('parse webmsg failed', err); }
  };

  const openNavigation = () => {
    if (!emergencyLoc) return Alert.alert('No target', 'Emergency location not available');
    const dest = `${emergencyLoc.lat},${emergencyLoc.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    Linking.openURL(url).catch(err => Alert.alert('Open maps failed', String(err)));
  };

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <style>html,body,#map{height:100%;margin:0;padding:0}</style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const map = L.map('map').setView([14.5995, 120.9842], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      const responderIcon = L.divIcon({ className: 'responder-marker', html: '<div style="background:#FF5722;width:18px;height:18px;border-radius:50%;border:3px solid white"></div>', iconSize:[24,24], iconAnchor:[12,12] });
      const emergencyIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25,41], iconAnchor: [12,41] });
      let responderMarker = null;
      let emergencyMarker = null;
      let routeLayer = null;

      function updateResponderLocation(lat,lng){
        if (responderMarker) responderMarker.setLatLng([lat,lng]);
        else responderMarker = L.marker([lat,lng], { icon: responderIcon }).addTo(map).bindPopup('You');
      }

      function setTargetLocation(lat,lng){
        if (emergencyMarker) emergencyMarker.setLatLng([lat,lng]);
        else emergencyMarker = L.marker([lat,lng], { icon: emergencyIcon }).addTo(map).bindPopup('Emergency');
      }

      async function computeRoute(fromLng, fromLat, toLng, toLat){
        try{
          if (routeLayer) map.removeLayer(routeLayer);
          const url = 'https://router.project-osrm.org/route/v1/driving/' + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + '?overview=full&geometries=geojson';
          const r = await fetch(url);
          const data = await r.json();
          if (data.routes && data.routes[0]){
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            routeLayer = L.polyline(coords, { color: '#2196F3', weight: 5 }).addTo(map);
            const group = L.featureGroup([responderMarker||L.marker([fromLat,fromLng]), emergencyMarker||L.marker([toLat,toLng])]);
            map.fitBounds(group.getBounds(), { padding: [50,50] });
          }
        }catch(e){ console.error('route error', e); }
      }

      // Expose to React Native
      window.updateResponderLocation = updateResponderLocation;
      window.setTargetLocation = setTargetLocation;
      window.computeRoute = computeRoute;

      // Notify RN that webview is ready
      setTimeout(()=>{
        if (window && window.ReactNativeWebView) window.ReactNativeWebView.postMessage('map-ready');
      }, 500);
    </script>
  </body>
  </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={(e) => { if (e.nativeEvent.data === 'map-ready') setWebReady(true); onMessage(e); }}
        javaScriptEnabled
      />
      <View style={styles.controls}>
        <View style={{ flexDirection: 'column' }}>
          <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation}><Text style={styles.btnText}>Navigate</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.navigateBtn, { backgroundColor: '#4caf50', marginTop: 8 }]} onPress={() => setNotifModalVisible(true)}><Text style={styles.btnText}>Send Notification</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.centerBtn} onPress={() => {
          if (responderLoc) inject(`map.setView([${responderLoc.lat}, ${responderLoc.lng}], 15);`);
        }}><Text>Center on me</Text></TouchableOpacity>
      </View>
      <View style={styles.infoBar}>
        <Text style={{ color: '#333' }}>{eta ? `ETA: ${eta}` : 'ETA: --'}</Text>
        <Text style={{ color: '#333' }}>{distanceText ? `Distance: ${distanceText}` : 'Distance: --'}</Text>
      </View>

      <Modal visible={notifModalVisible} animationType="slide" transparent>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' }}>
          <View style={{ width:'90%', backgroundColor:'#fff', padding:16, borderRadius:8 }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>Send notification to resident</Text>
            <TextInput value={notifText} onChangeText={setNotifText} placeholder="Message" style={{ borderWidth:1, borderColor:'#ddd', padding:8, borderRadius:6, marginBottom:12 }} />
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)} style={{ padding:10 }}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                try {
                  const token = await AsyncStorage.getItem('userToken');
                  // send to emergency's user
                  if (!emergencyInfo || !emergencyInfo.user) return Alert.alert('No user found');
                  await api.post(`/notifications`, { userId: emergencyInfo.user.id, title: 'Message from responder', message: notifText }, { headers: { Authorization: `Bearer ${token}` } });
                  setNotifText('');
                  setNotifModalVisible(false);
                  Alert.alert('Sent', 'Notification sent to resident');
                } catch (err) {
                  console.error('send notif failed', err);
                  Alert.alert('Error', 'Failed to send notification');
                }
              }} style={{ padding:10, backgroundColor:'#1a73e8', borderRadius:6 }}><Text style={{ color:'#fff' }}>Send</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  navigateBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 8 },
  centerBtn: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  btnText: { color: '#fff', fontWeight: '700' }
  ,infoBar: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8 }
});
