import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
 
  Dimensions,
} from 'react-native';
import { api } from './src/services/api';

export default function ProfileScreen({ navigation, token, setToken }: { navigation: any; token: string | null; setToken: (t: string | null) => void }) {
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await api.get('/users/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (!mounted) return;
        setUserName(res.data.name || '');
        setUserEmail(res.data.email || '');
      } catch (err) {
        console.error('Failed to load profile in ProfileScreen:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [token]);

  const MenuItem = ({ title, icon, onPress }: { title: string; icon: string; onPress?: () => void }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIcon}><Feather name={icon as any} size={18} color="#0f1724" /></View>
      <Text style={styles.menuText}>{title}</Text>
      <Feather name="chevron-right" size={18} color="#666" />
    </TouchableOpacity>
  );

  const handleBack = () => {
    try { navigation.goBack(); } catch (e) { try { navigation.navigate('Main'); } catch (err) { /* ignore */ } }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.hero, { height: Math.round(SCREEN_HEIGHT * 0.40) }] }>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { /* placeholder: allow change avatar later */ }}>
          <Image source={require('./assets/icon.png')} style={styles.avatar} />
        </TouchableOpacity>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.email}>{userEmail}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('MedicalProfile', { token })}>
          <Text style={styles.editText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        

        <MenuItem title="Medical Info" icon="heart" onPress={() => navigation.navigate('MedicalProfile', { token })} />
        <MenuItem title="Evacuation Centers Map" icon="map" onPress={() => navigation.navigate('EvacuationCentersMap')} />
        <MenuItem title="Emergency Hotlines" icon="phone" onPress={() => navigation.navigate('EmergencyHotlines')} />

        <TouchableOpacity style={styles.logoutButton} onPress={() => {
          Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Logout', 
                style: 'destructive',
                onPress: async () => {
                  try {
                    // Clear any stored tokens
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                    await AsyncStorage.removeItem('userToken');
                    await AsyncStorage.removeItem('userRole');
                    setToken(null);
                  } catch (error) {
                    console.error('Error during logout:', error);
                    setToken(null); // Logout anyway
                  }
                }
              }
            ]
          );
        }}>
          <Feather name="log-out" size={18} color="#e11d48" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  hero: { backgroundColor: '#0f1724', alignItems: 'center', paddingVertical: 28, borderBottomLeftRadius: 60, borderBottomRightRadius: 60 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff',marginTop: 70 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 12 },
  email: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  body: { padding: 18 },
  editBtn: { alignSelf: 'center', marginTop: 18, marginBottom: 12, backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20 },
  backButton: { position: 'absolute', left: 16, top: 16, backgroundColor: 'transparent', padding: 8, zIndex: 10 },
  editText: { color: '#0f1724', fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#f3f4f6', borderRadius: 12, marginBottom: 12 },
  menuIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuText: { flex: 1, fontSize: 16, color: '#0f1724' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1c0c5', backgroundColor: '#fff' },
  logoutText: { color: '#e11d48', marginLeft: 8 },
});
