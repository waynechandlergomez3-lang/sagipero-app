import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert, Platform, Linking, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import MapComponent from './MapComponent';
import { api, getAuthToken } from '../services/api';
import { AxiosError } from 'axios';

interface LocationState {
  latitude: number;
  longitude: number;
}

export default function EvacuationCentersMap() {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<LocationState | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
  let locationSubscription: any = null;

  const init = async () => {
      try {
        // Check auth token first
        const token = await getAuthToken();
        if (!token) {
          Alert.alert(
            'Authentication Required',
            'Please login to view evacuation centers.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }

        console.log("Requesting location permission...");
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Location permission is required to show your position on the map and find the nearest evacuation center.',
            [
              { 
                text: 'Open Settings', 
                onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings()
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          setLoading(false);
          return;
        }

        // Fetch centers first
        console.log('Fetching evacuation centers...');
        console.log('Current auth token:', token);  // Log the token for verification
        
        const centersResponse = await api.get('/api/evacuation-centers', {
          headers: {
            Authorization: `Bearer ${token}`  // Explicitly set the auth header
          }
        });
        
        console.log('Evacuation centers loaded:', centersResponse.data);
        setCenters(centersResponse.data || []);

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        console.log("Initial location:", location);
        
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        // If there's a selected center (from previous session), MapComponent will handle `navigateTo` via props

        // Set up location watching
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10
          },
          (location) => {
            console.log("Location update:", location);
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            });
          }
        );

      } catch (error: unknown) {
        console.error('Error initializing:', error);
        
        const axiosError = error as AxiosError;
        const isAuthError = axiosError.response?.status === 401;
        
        Alert.alert(
          'Error',
          isAuthError 
            ? 'Please login to view evacuation centers.' 
            : 'Failed to initialize map. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        
        if (!isAuthError && axiosError.response) {
          console.error('Detailed error:', {
            status: axiosError.response.status,
            data: axiosError.response.data,
            headers: axiosError.response.headers
          });
        }
      } finally {
        setLoading(false);
      }
    };

    init();

    // cleanup for the location watcher
    return () => {
      if (locationSubscription && typeof locationSubscription.remove === 'function') {
        try { locationSubscription.remove(); } catch (e) { console.warn('Failed to remove location subscription', e); }
      }
    };
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2196F3" />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Centers selector */}
      <ScrollView horizontal style={styles.selector} contentContainerStyle={{ padding: 8 }} showsHorizontalScrollIndicator={false}>
        {centers.map((c: any) => {
          const cap = c.capacity || 0
          const occ = c.currentCount || 0
          const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0
          let status = 'Available'
          if (pct === 100) status = 'Full'
          else if (pct >= 76) status = 'High'
          else if (pct >= 50) status = 'Limited'
          else status = 'Available'
          const bg = c.isActive ? '#ecfdf5' : '#f3f4f6' // light green when open, light gray when closed
          const textColor = c.isActive ? '#065f46' : '#374151'
          return (
            <TouchableOpacity key={c.id} style={[styles.centerButton, { backgroundColor: bg }]} onPress={() => setSelectedCenter({ lat: c.location.lat, lng: c.location.lng })} activeOpacity={0.8}>
              <Text style={[styles.centerName, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">{c.name}{!c.isActive ? ' (Closed)' : ''}</Text>
              <Text style={[styles.centerMeta, { color: textColor }]} numberOfLines={2} ellipsizeMode="tail">{`Capacity: ${cap} • Occupied: ${occ} • ${pct}% • ${status}`}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <MapComponent 
        centers={centers} 
        userLocation={userLocation}
        navigateTo={selectedCenter}
        initialRegion={{
          latitude: 14.834,
          longitude: 120.732,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  selector: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  centerButton: { padding: 8, marginRight: 8, backgroundColor: '#f8fafc', borderRadius: 8, minWidth: 120, maxWidth: 260 },
  centerName: { fontWeight: '600', fontSize: 14 },
  centerMeta: { fontSize: 12, color: '#444' }
})