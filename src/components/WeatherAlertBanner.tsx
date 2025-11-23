import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';
import { socket } from '../services/socket';
import notifService from '../services/notifications';

// Enhanced Weather Alert banner: carousel, date/forecast display, realtime socket updates, local notification
export default function WeatherAlertBanner() {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const rotRef = useRef<number | null>(null);

  useEffect(() => {
    fetchAlerts();
    const pollId = setInterval(fetchAlerts, 60000);
    try { if (socket && typeof socket.on === 'function') socket.on('notification:new', onNotificationReceived); } catch (e) { console.warn('socket on failed', e); }
    return () => { clearInterval(pollId); try { if (socket && typeof socket.off === 'function') socket.off('notification:new', onNotificationReceived); } catch (e) { /* ignore */ } };
  }, []);

  async function fetchAlerts(){
    try{
      setLoading(true);
      const res = await api.get('/weather-alerts');
      if(Array.isArray(res.data) && res.data.length > 0){
        // prefer active alerts
        const list = res.data.filter((x:any)=>x.isActive);
        setAlerts(list.length ? list : res.data);
        setIndex(0);
      }else{
        setAlerts([]);
        setIndex(0);
      }
    }catch(e){
      console.warn('Failed to fetch weather alerts', e);
      Toast.show({ type: 'error', text1: 'Alerts fetch failed' });
    }finally{ setLoading(false); }
  }

  function onNotificationReceived(payload: any){
    try{
      if(!payload) return;
      // backend emits notification:new for created notifications (including WEATHER)
      if(payload?.type === 'WEATHER' || payload?.data?.weatherAlertId){
        fetchAlerts();
        if (notifService && typeof notifService.showLocalNotification === 'function'){
          try{ notifService.showLocalNotification(payload.title || 'Weather Alert', payload.message || 'See details in app', payload.data || {}); }catch(e){ console.warn('local notif failed', e);}        
        }
      }
    }catch(e){ console.warn('onNotificationReceived', e); }
  }

  // carousel rotation
  useEffect(()=>{
    if(alerts.length > 1){
      rotRef.current = setInterval(()=> setIndex(i => (i+1) % alerts.length) as any, 6000) as any;
    }else{
      if(rotRef.current){ clearInterval(rotRef.current as any); rotRef.current = null; }
    }
    return ()=>{ if(rotRef.current){ clearInterval(rotRef.current as any); rotRef.current = null; } }
  }, [alerts]);

  if(loading) return null;
  if(!alerts || alerts.length === 0) return null;

  const alert = alerts[index];

  return (
    <TouchableOpacity style={styles.container} onPress={() => Toast.show({ type: 'info', text1: alert.title, text2: `${alert.message}\n\nDate: ${new Date(alert.createdAt || alert.startsAt || Date.now()).toLocaleString()}${alert.hourlyIndexes && alert.hourlyIndexes.length ? `\nHours: ${alert.hourlyIndexes.join(', ')}` : ''}` })}>
      <View style={styles.iconBox}><Text style={styles.icon}>⚠️</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{alert.title}</Text>
        <Text numberOfLines={2} style={styles.message}>{alert.message}</Text>
        <Text style={styles.meta}>Date: {new Date(alert.createdAt || alert.startsAt || Date.now()).toLocaleString()}</Text>
        {alert.hourlyIndexes && Array.isArray(alert.hourlyIndexes) && alert.hourlyIndexes.length > 0 && (
          <Text style={styles.meta}>Hours: {alert.hourlyIndexes.join(', ')}</Text>
        )}
        {alert.daily && <Text style={styles.meta}>Daily forecast included</Text>}
      </View>
      <View style={styles.chev}><Text style={{ color: '#fff', fontWeight: '700' }}>{alerts.length > 1 ? `${index+1}/${alerts.length}` : '!'}</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#b71c1c', padding: 12, borderRadius: 10, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 20 },
  title: { color: '#fff', fontWeight: '900', fontSize: 14 },
  message: { color: '#ffe6e6', marginTop: 4 },
  chev: { backgroundColor: '#7f0000', padding: 8, borderRadius: 8, marginLeft: 8 }
  ,meta: { color: '#ffe6e6', marginTop: 4, fontSize: 12 }
});
