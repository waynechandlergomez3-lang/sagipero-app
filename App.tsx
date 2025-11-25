import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { sendSOS, discoverBackend, api as apiClient } from './src/services/api';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import WeatherAlertBanner from './src/components/WeatherAlertBanner';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RegisterScreen from './RegisterScreen';
import ProfileScreen from './ProfileScreen';
import LoginScreen from './LoginScreen';
// Load ResponderHome at runtime to avoid static module resolution issues in some TS configs
// @ts-ignore
const ResponderHome = require('./src/components/ResponderHome').default;
import ResponderMap from './src/components/ResponderMap';
import EvacuationCentersMap from './src/components/EvacuationCentersMap';
import EmergencyTracker from './src/components/EmergencyTracker';
import WeatherView from './src/components/WeatherView';
import EmergencyHotlines from './src/components/EmergencyHotlines';
import MedicalProfileForm from './src/components/MedicalProfileForm';
import Notifications from './src/components/Notifications';
import { initializeSocket, socket } from './src/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { SOSButton } from './src/components/SOSButton';
import ResponderInventory from './src/components/ResponderInventory';
import ResponderVehicles from './src/components/ResponderVehicles';
import CitizenMediaScreen from './src/components/CitizenMediaScreen';
import ConcernedCitizenScreen from './src/components/ConcernedCitizenScreen';

// runtime discovery will update the api base; fallbacks live in src/services/config.ts
const Stack = createNativeStackNavigator();

const situationStatuses = [
  { label: 'I am safe', value: 'SAFE', color: '#4CAF50' },
  { label: 'Need assistance', value: 'NEED_ASSISTANCE', color: '#FFC107' },
  { label: 'Emergency', value: 'EMERGENCY', color: '#F44336' },
];

function MainScreen({ token, setToken, navigation }: { token: string | null, setToken: (t: string | null) => void, navigation: any }) {
  const [loading, setLoading] = useState(false);
  const [situationStatus, setSituationStatus] = useState('SAFE');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [latestArticle, setLatestArticle] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [assignedModalVisible, setAssignedModalVisible] = useState(false);
  const [assignedEmergency, setAssignedEmergency] = useState<any>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{title: string, icon: string, keywords: string[], route: string}>>([]);

  // Mount-time listeners: always subscribe so timing/order of initializeSocket doesn't matter
  React.useEffect(() => {
    const onConnect = () => console.log('App: socket connected');
    const onDisconnect = (reason: any) => console.log('App: socket disconnected', reason);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const sosHandler = async (payload: any) => {
      console.log('App: sos handler received', payload);
      try {
        const cur = userIdRef.current;
        let em: any = null;
        if (payload?.emergencyId) {
          try { const res = await apiClient.get(`/emergencies/${payload.emergencyId}`); em = res.data; } catch (e) { console.warn('App: failed fetch emergency', e); }
        } else if (payload?.userId && payload.userId === cur) {
          em = payload;
        }
        if (em && (em.userId === cur || em.user?.id === cur)) {
          console.log('App: sos belongs to current user, showing modal');
          setAssignedEmergency(em);
          setAssignedModalVisible(true);
          Alert.alert('Emergency Created', 'Your emergency request has been sent');
        }
      } catch (e) { console.warn('App: sos handler error', e); }
    };

    const createdHandler = async (payload: any) => {
      console.log('App: emergency:created', payload);
      try {
        const cur = userIdRef.current;
        // Check common top-level fields
        let isMine = !!(payload && (payload.userId === cur || payload.residentId === cur || payload.createdBy === cur));
        // Also check nested user field if present
        if (!isMine && payload && payload.user && payload.user.id) {
          isMine = payload.user.id === cur;
        }

        // If payload doesn't clearly identify owner but includes an emergencyId, fetch authoritative record
        if (!isMine && payload && payload.emergencyId) {
          try {
            const res = await apiClient.get(`/emergencies/${payload.emergencyId}`);
            const em = res?.data;
            if (em) {
              const emOwner = em.userId || em.residentId || em.createdBy || (em.user && em.user.id);
              isMine = !!(emOwner && emOwner === cur);
              if (isMine) {
                console.log('App: fetched emergency belongs to current user');
                setAssignedEmergency(em);
                setAssignedModalVisible(true);
                  Alert.alert('Emergency Created', 'Your emergency request has been sent');
                return;
              }
            }
          } catch (e) {
            console.warn('App: failed to fetch emergency for created handler', e);
          }
        }

        if (isMine) {
          console.log('App: created belongs to current user');
          setAssignedEmergency(payload);
          setAssignedModalVisible(true);
          Alert.alert('Emergency Created', 'Your emergency request has been sent');
        }
      } catch (e) { console.warn('App: created handler error', e); }
    };

    const resolvedHandler = (payload: any) => {
      console.log('App: emergency:resolved', payload);
      try {
        const cur = userIdRef.current;
        const isMine = !!(payload && (payload.userId === cur || payload.residentId === cur || payload.resolvedFor === cur));
        if (isMine) {
          setAssignedEmergency(null);
          setAssignedModalVisible(false);
          setSituationStatus('SAFE');
          Alert.alert('Emergency Resolved', 'Your emergency has been marked resolved. You can use SOS again.');
        }
      } catch (e) { console.warn('App: resolved handler error', e); }
    };

    socket.on('sos:triggered', sosHandler);
    socket.on('emergency:created', createdHandler);
    socket.on('emergency:resolved', resolvedHandler);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sos:triggered', sosHandler);
      socket.off('emergency:created', createdHandler);
      socket.off('emergency:resolved', resolvedHandler);
    };
  }, []);

  useEffect(() => {
    // perform backend discovery on app start so API and socket use correct LAN host
    ;(async () => {
      try {
        const discovered = await discoverBackend().catch(() => null)
        if (discovered?.socketBase) {
          try { await initializeSocket() } catch(e) { /* ignore: socket init done after login */ }
        }
      } catch (e) {
        console.warn('Backend discovery failed', e)

      // Poll /emergencies/latest every 1s to keep assigned emergency in sync
      useEffect(() => {
        if (!token) return;
        let iv: any = null;
        iv = setInterval(async () => {
          try {
            const res = await apiClient.get('/emergencies/latest', { headers: { Authorization: `Bearer ${token}` } });
            if (res?.data) setAssignedEmergency(res.data);
          } catch (e) {
            // ignore transient errors
          }
        }, 1000);
        return () => { if (iv) clearInterval(iv); };
      }, [token]);
      }
    })()

    if (token) {
      fetchUserProfile();
      fetchUnreadCount();
      fetchLatestArticle();
      // subscribe to socket notifications to increment badge and assignment events
        try {
          socket.on('notification:new', async (notif: any) => {
            try {
              setUnreadCount(c => c + 1);
              // If notification contains emergencyId, fetch emergency and show modal if it belongs to current user
              if (notif && notif.data && notif.data.emergencyId) {
                const cur = userIdRef.current;
                try {
                  const res = await apiClient.get(`/emergencies/${notif.data.emergencyId}`);
                  const em = res?.data;
                  if (em && (em.userId === cur || em.user?.id === cur)) {
                    setAssignedEmergency(em);
                    setAssignedModalVisible(true);
                    Alert.alert('Emergency Created', 'Your emergency request has been sent');
                  }
                } catch (e) {
                  console.warn('Failed to fetch emergency for notification:new', e);
                }
              }
            } catch (e) { console.warn('notification:new handler error', e); }
          });
        socket.on('emergency:assigned', (payload: any) => {
          console.log('Received emergency:assigned via socket', payload);
          setAssignedEmergency(payload);
          setAssignedModalVisible(true);
        });
        // listen for created/resolved events to alert resident
        socket.on('emergency:created', async (payload: any) => {
          try {
            console.log('Received emergency:created', payload);
            const cur = userIdRef.current;
            let isMine = !!(payload && (payload.userId === cur || payload.residentId === cur || payload.createdBy === cur));
            if (!isMine && payload && payload.user && payload.user.id) {
              isMine = payload.user.id === cur;
            }
            if (!isMine && payload && payload.emergencyId) {
              try {
                const res = await apiClient.get(`/emergencies/${payload.emergencyId}`);
                const em = res?.data;
                if (em) {
                  const emOwner = em.userId || em.residentId || em.createdBy || (em.user && em.user.id);
                  isMine = !!(emOwner && emOwner === cur);
                  if (isMine) {
                    Alert.alert('Emergency Created', 'Your emergency request has been sent');
                    setAssignedEmergency(em);
                    setAssignedModalVisible(true);
                  }
                }
              } catch (e) {
                console.warn('Failed to fetch emergency for emergency:created', e);
              }
            } else if (isMine) {
              Alert.alert('Emergency Created', 'Your emergency request has been sent');
              setAssignedEmergency(payload);
              setAssignedModalVisible(true);
            }
          } catch (e) { console.warn('emergency:created handler error', e); }
        });
        socket.on('emergency:resolved', (payload: any) => {
          try {
            console.log('Received emergency:resolved', payload);
            const cur = userIdRef.current;
            const isMine = !!(payload && (payload.userId === cur || payload.residentId === cur || payload.resolvedFor === cur));
            if (isMine) {
              Alert.alert('Emergency Resolved', 'Your emergency has been marked resolved. You can use SOS again.');
              setAssignedEmergency(null);
              setAssignedModalVisible(false);
              // reset situation status if needed
              setSituationStatus('SAFE');
            }
          } catch (e) { console.warn('emergency:resolved handler error', e); }
        });
        // Some deployments emit sos:triggered with emergencyId; fetch authoritative emergency and show modal
        socket.on('sos:triggered', async (payload: any) => {
          try {
            console.log('Received sos:triggered via socket', payload);
            const cur = userIdRef.current;
            // payload may include emergencyId or userId; if emergencyId present, fetch emergency
            let em: any = null;
            if (payload && payload.emergencyId) {
              try {
                const res = await apiClient.get(`/emergencies/${payload.emergencyId}`);
                em = res?.data;
              } catch (e) {
                console.warn('Failed to fetch emergency for sos:triggered', e);
              }
            } else if (payload && payload.userId) {
              // if the payload included user id, and it matches current user, use payload
              if (payload.userId === cur) em = payload;
            }
            if (em && (em.userId === cur || em.responderId === cur || em.user?.id === cur)) {
              setAssignedEmergency(em);
              setAssignedModalVisible(true);
              Alert.alert('Emergency Created', 'Your emergency request has been sent');
            }
          } catch (e) { console.warn('sos:triggered handler error', e); }
        });
      } catch (e) {
        console.warn('socket subscribe failed', e);
      }
    }
    // cleanup listeners when token changes/unmount
    return () => {
      try {
        socket.off('notification:new');
        socket.off('emergency:assigned');
        socket.off('emergency:created');
        socket.off('emergency:resolved');
      } catch (e) { /**/ }
    };
  }, [token]);

  const fetchUnreadCount = async () => {
    try {
  const res = await apiClient.get('/notifications', { headers: { Authorization: `Bearer ${token}` } });
      const unread = Array.isArray(res.data) ? res.data.filter((n: any) => !n.isRead).length : 0;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  };

  const fetchLatestArticle = async () => {
    try {
      const res = await apiClient.get('/articles/latest');
      setLatestArticle(res.data || null);
    } catch (e) {
      console.warn('Failed to fetch latest article', e);
    }
  };

  const handleRefreshEmergency = async () => {
    if (!token) return;
    try {
      const res = await apiClient.get('/emergencies/latest', { headers: { Authorization: `Bearer ${token}` } });
      if (res?.data) {
        // update assignedEmergency in this screen's state
        setAssignedEmergency(res.data);
        // if the latest emergency is resolved, allow SOS again by clearing assigned emergency
        if ((res.data.status || '').toUpperCase() === 'RESOLVED') {
          setAssignedEmergency(null);
        }
      } else {
        setAssignedEmergency(null);
      }
    } catch (e) {
      console.warn('Refresh emergency failed', e);
      setAssignedEmergency(null);
    }
  };

  const fetchUserProfile = async () => {
    try {
  const response = await apiClient.get('/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserName(response.data.name);
      setUserId(response.data.id || null);
      userIdRef.current = response.data.id || null;
      setUserEmail(response.data.email);
      setSituationStatus(response.data.situationStatus || 'SAFE');
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const updateSituationStatus = async (newStatus: string) => {
    try {
      await apiClient.put(
        `/users/situation-status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSituationStatus(newStatus);
      Alert.alert('Status Updated', 'Your situation status has been updated successfully.');
    } catch (err) {
      console.error('Failed to update situation status:', err);
      Alert.alert('Error', 'Failed to update your status. Please try again.');
    }
  };

  const handleSOS = async () => {
    setLoading(true);
    try {
      if (!token) {
        Alert.alert('Not logged in', 'Please login first.');
        return;
      }
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to send SOS.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      // Use centralized sendSOS to ensure consistent behavior and logging
      const result = await sendSOS({ latitude, longitude }, 'SOS');
      if (!result.success) {
        throw new Error(result.message || 'Failed to send SOS');
      }

      await updateSituationStatus('EMERGENCY');
      Alert.alert('SOS Sent', 'Emergency services have been notified of your location.');
    } catch (err: any) {
      console.error('SOS error:', err);
      Alert.alert('Error', 'Failed to send SOS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const MenuItem = ({ title, icon, onPress }: { title: string, icon: string, onPress: () => void }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon as any} size={24} color="#1a73e8" />
      <Text style={styles.menuItemText}>{title}</Text>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* News bulletin (top) */}
      <LinearGradient colors={['#f9fafb', '#eef0f3']} style={styles.newsCard}>
        <View style={styles.newsInner}>
          <Image
            source={
              latestArticle?.imageUrl
                ? { uri: latestArticle.imageUrl }
                : require('./assets/splash-icon.png')
            }
            style={styles.newsImage}
            resizeMode="cover"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.newsHeadline} numberOfLines={2}>
              {latestArticle?.title || 'No recent article'}
            </Text>
            <Text style={styles.newsSource}>
              {(latestArticle?.source || '') +
                (latestArticle?.source && latestArticle?.createdAt
                  ? ' · ' + new Date(latestArticle.createdAt).toLocaleDateString()
                  : '')}
            </Text>
          </View>
        </View>
        <View style={styles.newsFooter}>
          {latestArticle?.source && (
            <View style={styles.newsBadge}>
              <Ionicons name="location" size={14} color="#fff" />
              <Text style={styles.newsBadgeText}> {latestArticle.source}</Text>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.newsBadge, styles.openBadge]} 
            onPress={() => latestArticle?.url && Linking.openURL(latestArticle.url)}>
            <Ionicons name="open-outline" size={14} color="#fff" />
            <Text style={styles.newsBadgeText}> Open</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* header: search left, avatar right */}
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          <>
            <TextInput 
              placeholder="Search pages (e.g., Emergency, Weather)" 
              placeholderTextColor="#888" 
              style={styles.searchInput} 
              returnKeyType="search"
              onChangeText={(text) => {
                const query = text.toLowerCase();
                const suggestions = [
                  { title: 'Emergency Tracker', icon: 'locate', keywords: ['track', 'emergency', 'sos', 'help'], route: 'EmergencyTracker' },
                  { title: 'Notifications', icon: 'notifications', keywords: ['notify', 'notification', 'alert', 'message'], route: 'Notifications' },
                  { title: 'Weather Information', icon: 'cloud', keywords: ['weather', 'storm', 'rain', 'forecast'], route: 'WeatherView' },
                  { title: 'Profile Settings', icon: 'person', keywords: ['profile', 'account', 'user', 'settings'], route: 'Profile' },
                  { title: 'Emergency Hotlines', icon: 'call', keywords: ['hotline', 'phone', 'call', 'contact'], route: 'EmergencyHotlines' },
                  { title: 'Medical Profile', icon: 'medical', keywords: ['medical', 'health', 'doctor'], route: 'MedicalProfile' },
                  { title: 'Evacuation Centers', icon: 'location', keywords: ['evac', 'center', 'location', 'shelter'], route: 'EvacuationCentersMap' },
                  { title: 'Concerned Citizen', icon: 'person-add', keywords: ['media', 'photo', 'video', 'submit', 'citizen', 'concern', 'location'], route: 'ConcernedCitizen' },
                ].filter(item => 
                  query && (item.title.toLowerCase().includes(query) || 
                  item.keywords.some(k => k.includes(query)))
                );
                setSearchSuggestions(suggestions);
              }}
            />
            {searchSuggestions.length > 0 && (
              <View style={styles.searchSuggestions}>
                {searchSuggestions.map((suggestion, index) => (
                  <TouchableOpacity 
                    key={suggestion.route} 
                    style={[
                      styles.suggestionItem,
                      index === searchSuggestions.length - 1 && { borderBottomWidth: 0 }
                    ]}
                    onPress={() => {
                      navigation.navigate(suggestion.route);
                      setSearchSuggestions([]);
                    }}
                  >
                    <Ionicons name={suggestion.icon as any} size={20} color="#666" />
                    <Text style={styles.suggestionText}>{suggestion.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)} style={styles.headerAvatarWrap}>
          <View style={styles.avatarContainer}><Text style={styles.avatarText}>{userName ? userName.charAt(0) : '?'}</Text></View>
        </TouchableOpacity>
      </View>

      {/* main */}
      <View style={styles.mainContent}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Emergency Status</Text>
          <TouchableOpacity 
            onPress={async () => {
              try {
                await handleRefreshEmergency();
                // Also refresh other important data
                await Promise.all([
                  fetchUserProfile(),
                  fetchUnreadCount(),
                  fetchLatestArticle()
                ]);
                Alert.alert('Updated', 'Emergency status and notifications refreshed successfully');
              } catch (err) {
                console.warn('Refresh failed:', err);
                Alert.alert('Error', 'Failed to refresh. Please try again.');
              }
            }} 
            style={styles.refreshButton}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statusSectionSmall}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={situationStatus} onValueChange={updateSituationStatus} style={styles.picker}>
              {situationStatuses.map(s => (<Picker.Item key={s.value} label={s.label} value={s.value} color={s.color} />))}
            </Picker>
          </View>
        </View>

        <View style={styles.sosCenter}><SOSButton /></View>
      </View>

      {/* assigned modal */}
      <Modal visible={assignedModalVisible} transparent animationType="slide">
        <View style={styles.assignedOverlay}>
          <View style={styles.assignedCard}>
            <View style={styles.assignedImageContainer}><Image source={require('./assets/splash-icon.png')} style={styles.assignedImage} resizeMode="contain" /></View>
            <View style={styles.assignedBody}>
              <Text style={styles.assignedTitle}>Ambulance and responders are on their way.</Text>
              <Text style={styles.assignedText}>Speak calmly to the person until the first aider arrives. First responders are on the way and Rescue team is alarmed.</Text>
              <Pressable style={styles.assignedButton} onPress={() => { setAssignedModalVisible(false); navigation.navigate('EmergencyTracker'); }}>
                <Text style={styles.assignedButtonText}>See the location of the rescue.</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('EmergencyTracker')}><Ionicons name="locate" size={22} color="#fff" /><Text style={styles.navText}>Track</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => { setUnreadCount(0); navigation.navigate('Notifications'); }}><Ionicons name="notifications" size={22} color="#fff" />{unreadCount > 0 && <View style={styles.bottomBadge}><Text style={{ color: '#fff', fontWeight: '700' }}>{unreadCount}</Text></View>}<Text style={styles.navText}>Notifications</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('WeatherView')}><Ionicons name="cloud" size={22} color="#fff" /><Text style={styles.navText}>Weather</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={async () => { try { await AsyncStorage.removeItem('userToken'); } catch (e) { } setToken(null); }}><Ionicons name="log-out" size={22} color="#fff" /><Text style={styles.navText}>Logout</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<'LOGIN' | 'REGISTER' | 'MAIN' | 'RESPONDER'>('LOGIN');

  // Save or remove token in AsyncStorage and update app state
  const saveToken = async (t: string | null) => {
    try {
      if (t) {
        await AsyncStorage.setItem('userToken', t);
        console.log('Saved token to AsyncStorage');
        setToken(t);
        // fetch profile to determine where to navigate
        try {
    const profileRes = await apiClient.get('/users/profile', { headers: { Authorization: `Bearer ${t}` } });
          const role = profileRes.data.role;
          if (role === 'RESPONDER') setScreen('RESPONDER');
          else setScreen('MAIN');
        } catch (err) {
          console.warn('Failed to fetch profile after login', err);
          setScreen('MAIN');
        }
        // initialize socket connection with stored token
        try {
          await initializeSocket();
        } catch (err) {
          console.warn('Failed to initialize socket after login:', err);
        }
        // register push token
        try { await registerForPushNotificationsAsync(); } catch(e) { console.warn('Push register failed', e); }
  // push registration temporarily disabled (dev-client required)
      } else {
        await AsyncStorage.removeItem('userToken');
        console.log('Removed token from AsyncStorage');
  setToken(null);
  setScreen('LOGIN');
        try {
          // disconnect socket on logout
          socket.disconnect();
        } catch (e) {
          console.warn('Failed to disconnect socket on logout', e);
        }
      }
    } catch (err) {
      console.error('Error saving token:', err);
      // fallback to in-memory token
      setToken(t);
      if (!t) setScreen('LOGIN');
    }
  };

  const handleLoginSuccess = (t: string) => saveToken(t);
  const handleRegisterSuccess = (t: string) => saveToken(t);
  // registration success flow is handled by RegisterScreen -> RegistrationSuccess navigation

  return (
    <NavigationContainer>
      <Stack.Navigator>
  {screen === 'LOGIN' && (
          <Stack.Screen
            name="Login"
            options={{ headerShown: false }}
          >
            {() => <LoginScreen onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setScreen('REGISTER')} />}
          </Stack.Screen>
        )}
        {screen === 'REGISTER' && (
          <Stack.Screen
            name="Register"
            options={{ headerShown: false }}
          >
            {() => <RegisterScreen onGoToLogin={() => setScreen('LOGIN')} onRegisterComplete={handleRegisterSuccess} />}
          </Stack.Screen>
        )}
        {/* RegistrationSuccess is shown by RegisterScreen after a successful signup */}
        {screen === 'MAIN' && (
          <Stack.Screen
            name="Main"
            options={{ headerShown: false }}
          >
            {({ navigation }) => (
              <MainScreen
                token={token}
                setToken={(t) => {
                  setToken(t);
                  if (!t) setScreen('LOGIN');
                }}
                navigation={navigation}
              />
            )}
          </Stack.Screen>
        )}
        {screen === 'RESPONDER' && (
          <Stack.Screen name="ResponderHome" options={{ headerShown: false }}>
            {({ navigation }) => <ResponderHome navigation={navigation} token={token} />}
          </Stack.Screen>
        )}
        <Stack.Screen name="ResponderInventory" options={{ headerShown: true, title: 'My Inventory' }}>
          {({ navigation }) => <ResponderInventory navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="ResponderVehicles" options={{ headerShown: true, title: 'My Vehicles' }}>
          {({ navigation }) => <ResponderVehicles navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="Profile" options={{ headerShown: false }}>
          {({ navigation }) => <ProfileScreen navigation={navigation} token={token} setToken={saveToken} />}
        </Stack.Screen>
  <Stack.Screen name="ResponderMap" component={ResponderMap} options={{ headerShown: true, title: 'Responder Map' }} />
        <Stack.Screen
          name="EvacuationCentersMap"
          component={EvacuationCentersMap}
          options={{
            headerShown: true,
            title: 'Evacuation Centers',
            headerStyle: {
              backgroundColor: '#1a73e8',
            },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="EmergencyTracker"
          component={EmergencyTracker}
          options={{ headerShown: true, title: 'Track Emergency', headerStyle: { backgroundColor: '#1a73e8' }, headerTintColor: '#fff' }}
        />
        <Stack.Screen
          name="WeatherView"
          component={WeatherView}
          options={{
            headerShown: true,
            title: 'Weather Information',
            headerStyle: {
              backgroundColor: '#1a73e8',
            },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="EmergencyHotlines"
          component={EmergencyHotlines}
          options={{
            headerShown: true,
            title: 'Emergency Hotlines',
            headerStyle: {
              backgroundColor: '#e74c3c',
            },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen name="MedicalProfile" options={{ headerShown: true, title: 'Medical Profile', headerStyle: { backgroundColor: '#1a73e8' }, headerTintColor: '#fff' }}>
          {({ navigation, route }) => <MedicalProfileForm navigation={navigation} route={route as any} />}
        </Stack.Screen>
        <Stack.Screen name="Notifications" options={{ headerShown: true, title: 'Notifications', headerStyle: { backgroundColor: '#1a73e8' }, headerTintColor: '#fff' }}>
          {({ navigation, route }) => <Notifications navigation={navigation} route={route as any} />}
        </Stack.Screen>
        <Stack.Screen name="CitizenMedia" options={{ headerShown: false }}>
          {({ navigation, route }) => <CitizenMediaScreen navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="ConcernedCitizen" options={{ headerShown: false }}>
          {({ navigation, route }) => <ConcernedCitizenScreen navigation={navigation} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  editProfileButton: {
    marginTop: 15,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  editProfileText: {
    color: '#1a73e8',
    fontWeight: '500',
  },
  statusSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  sosButton: {
    backgroundColor: '#F44336',
    margin: 20,
    padding: 15,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sosButtonDisabled: {
    opacity: 0.7,
  },
  sosButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loader: {
    marginLeft: 10,
  },
  menuSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  assignedBody: { padding: 16, alignItems: 'center' },
  assignedTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  assignedText: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 12 },
  assignedButton: { backgroundColor: '#eee', padding: 12, borderRadius: 8 },
  assignedButtonText: { color: '#333', fontWeight: '700' },
  assignedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  assignedCard: { width: '90%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', alignItems: 'center' },
  assignedImageContainer: { width: '100%', height: 160, backgroundColor: '#0f1724', alignItems: 'center', justifyContent: 'center' },
  assignedImage: { width: '90%', height: 120 },

  /* New layout styles for updated Main screen */
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerAvatarWrap: { paddingRight: 12 },
  searchWrap: { flex: 1, position: 'relative' },
  searchInput: { backgroundColor: '#f0f0f0', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, color: '#111' },
  searchSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  sosCenter: { alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 0 },
  statusSectionSmall: { width: '100%', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 80, marginTop: -100 },

  /* bottom pill nav to match screenshot colors */
  bottomNav: { position: 'absolute', left: 16, right: 16, bottom: 16, height: 64, backgroundColor: '#0a0a54ff', borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#fff', fontSize: 12, marginTop: 6 },
  bottomBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ff3b30', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },

  /* News bulletin styles */
  newsCard: { 
    margin: 12,
    marginTop: 40, 
    padding: 14, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    shadowColor: '#000', 
    height: 200,
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 10, 
    elevation: 5 
  },
  newsInner: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  newsImage: { 
    width: 120, 
    height: 120, 
    borderRadius: 12, 
    backgroundColor: '#eef0f3' 
  },
  newsHeadline: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#111' 
  },
  newsSource: { 
    marginTop: 6, 
    fontSize: 13, 
    color: '#666' 
  },
  newsFooter: { 
    flexDirection: 'row', 
    marginTop: 14, 
    justifyContent: 'flex-start' 
  },
  newsBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0d0b62', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 18, 
    marginRight: 8,
    shadowColor: '#0d0b62',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3
  },
  openBadge: {
    backgroundColor: '#1e88e5',
  },
  newsBadgeText: { 
    color: '#fff', 
    fontSize: 13, 
    marginLeft: 4,
    fontWeight: '600'
  },
  statusHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 12
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },
  // end styles
});
