import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

let Device: any = null;
let Notifications: any = null;

async function ensureNotifModules() {
  if (Notifications && Device) return { Notifications, Device };
  try {
    // dynamic import to avoid crashing Metro when native modules are missing/mismatched
    const notifMod: any = await import('expo-notifications');
    const deviceMod: any = await import('expo-device');
    // handle possible default export and nested default wrappers
    Notifications = notifMod;
    Device = deviceMod;
    const unwrap = (m: any) => {
      let cur = m;
      const seen = new Set();
      while (cur && typeof cur === 'object' && 'default' in cur && !seen.has(cur)) {
        seen.add(cur);
        cur = cur.default;
      }
      return cur;
    };
    Notifications = unwrap(Notifications);
    Device = unwrap(Device);
    console.log('ensureNotifModules: Notifications keys=', Notifications ? Object.keys(Notifications) : 'none');
    console.log('ensureNotifModules: Device keys=', Device ? Object.keys(Device) : 'none');
    // configure handler if available
    try {
      if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
        try{
          Notifications.setNotificationHandler({
            handleNotification: async () => ({ shouldPlaySound: true, shouldShowAlert: true, shouldSetBadge: true })
          });
        }catch(e){ console.warn('setNotificationHandler failed', e); }
      }
    } catch (e) { /* ignore */ }
    return { Notifications, Device };
  } catch (e) {
    console.warn('Expo notifications/device modules not available (dynamic import failed)', e);
    Notifications = null;
    Device = null;
    return null;
  }
}

export async function registerForPushNotificationsAsync() {
  try {
    const mod = await ensureNotifModules();
    if (!mod) return null;
    const { Notifications, Device } = mod;
    if (!Device || !Device.isDevice) {
      console.warn('Must use a physical device for push notifications');
      return null;
    }
    // permissions API may vary between versions; support a few shapes
    let finalStatus: string = 'undetermined';
    try{
      if (typeof Notifications.getPermissionsAsync === 'function'){
        const resp = await Notifications.getPermissionsAsync();
        finalStatus = resp?.status || resp || finalStatus;
      } else if (typeof Notifications.getPermissions === 'function'){
        const resp = await Notifications.getPermissions();
        finalStatus = resp?.status || resp || finalStatus;
      } else {
        console.warn('Notifications permission API not found on module, assuming granted for testing');
        finalStatus = 'granted';
      }

      if(finalStatus !== 'granted'){
        if (typeof Notifications.requestPermissionsAsync === 'function'){
          const resp = await Notifications.requestPermissionsAsync();
          finalStatus = resp?.status || resp || finalStatus;
        } else if (typeof Notifications.requestPermissions === 'function'){
          const resp = await Notifications.requestPermissions();
          finalStatus = resp?.status || resp || finalStatus;
        } else {
          console.warn('Notifications requestPermissions API not found, cannot prompt for permission');
        }
      }
    }catch(e){ console.warn('Error while checking/requesting notification permissions', e); }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    // getExpoPushTokenAsync may be named differently or missing depending on SDK; try common names
    let token: string | null = null;
    try{
      if (typeof Notifications.getExpoPushTokenAsync === 'function'){
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData?.data || tokenData || null;
      } else if (typeof Notifications.getDevicePushTokenAsync === 'function'){
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData?.data || tokenData || null;
      } else {
        // try alternative nested helpers
        if (Notifications && Notifications.ExpoPushToken && Notifications.ExpoPushToken.getTokenAsync) {
          try{ const td = await Notifications.ExpoPushToken.getTokenAsync(); token = td?.data || td || null; }catch(e){}
        }
        if(!token) console.warn('No push token API found on Notifications module');
      }
    }catch(e){ console.warn('Error obtaining push token', e); }
    if(!token){ console.warn('No push token obtained'); return null; }
    console.log('Got Expo push token', token);

    // Save to backend if we have a logged-in user
    const stored = await AsyncStorage.getItem('userToken');
    if (stored) {
      try {
        const resp = await api.post('/users/push-token', { token });
        try{ console.log('registerForPushNotificationsAsync: registered token with backend, status=', resp.status, 'data=', JSON.stringify(resp.data)); }catch(e){}
      } catch (e) { console.warn('Failed to register push token with backend', e); }
    }

    // create high-priority Android channel for weather alerts (best-effort)
    try{
      if (Notifications && Notifications.setNotificationChannelAsync) {
        await Notifications.setNotificationChannelAsync('weather-alerts', {
          name: 'Weather Alerts',
          importance: Notifications.AndroidImportance.MAX || 5,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250]
        });
      }
    }catch(e){ /* ignore */ }

    return token;
  } catch (err) {
    console.error('registerForPushNotificationsAsync error', err);
    return null;
  }
}

export async function showLocalNotification(title: string, body: string, data: any = {}) {
  try {
    const mod = await ensureNotifModules();
    if (!mod) return;
    const { Notifications } = mod;
    // prefer richer info from payload if present
    let finalTitle = title;
    let finalBody = body;
    try{
      if(data){
        // if full weatherAlert object provided
        const wa = data.weatherAlert || data.weather || null;
        const meta = data.meta || (wa && wa.area && wa.area.meta) || null;
        const parts: string[] = [];
        if(meta && meta.condition) parts.push(meta.condition);
        if(meta && typeof meta.temp === 'number') parts.push(`${Math.round(meta.temp)}°C`);
        if(parts.length) finalBody = `${parts.join(' • ')} — ${finalBody}`;
      }
    }catch(e){ /* ignore */ }

    const content: any = { title: finalTitle, body: finalBody, data };
    // Android-specific: try to set priority via channelId if channels are configured
    try{ content.android = { channelId: 'weather-alerts', importance: 'max', sound: 'default' }; }catch(e){}

    // try available notification presentation methods
    if (typeof Notifications.scheduleNotificationAsync === 'function'){
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } else if (typeof Notifications.presentNotificationAsync === 'function'){
      await Notifications.presentNotificationAsync(content);
    } else if (typeof Notifications.presentLocalNotificationAsync === 'function'){
      await Notifications.presentLocalNotificationAsync(content);
    } else {
      console.warn('No supported local notification API available on Notifications module', Object.keys(Notifications || {}));
      throw new Error('No local notification API');
    }
  } catch (e) { console.warn('showLocalNotification failed', e); }
}

export default { registerForPushNotificationsAsync, showLocalNotification };
