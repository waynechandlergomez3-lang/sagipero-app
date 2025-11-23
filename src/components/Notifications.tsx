import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import axios from 'axios';
import { api } from '../services/api';
import { socket } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isAlertType = (t?: string) => {
  if (!t) return false;
  return t.toLowerCase() === 'alert' || t.toLowerCase() === 'ALERT'.toLowerCase();
};

const Notifications = ({ navigation }: any) => {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
  const res = await api.get('/notifications', { headers: { Authorization: `Bearer ${token}` } });
        if (mounted) setItems(res.data || []);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    load();

    const handler = (notif: any) => {
      // ensure a consistent shape: add createdAt if missing
      const n = { createdAt: new Date().toISOString(), isRead: false, ...notif };
      setItems(prev => [n, ...prev]);
    };

    socket.on('notification:new', handler);

    return () => {
      mounted = false;
      socket.off('notification:new', handler);
    };
  }, []);

  const markAsRead = async (notif: any) => {
    if (!notif || !notif.id) {
      // Can't mark unread without id; just update UI
      setItems(prev => prev.map(i => (i === notif ? { ...i, isRead: true } : i)));
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('No token');
  await api.put(`/notifications/${notif.id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setItems(prev => prev.map(i => (i.id === notif.id ? { ...i, isRead: true } : i)));
    } catch (err) {
      console.error('Failed to mark notification read', err);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const alertItems = items.filter(i => isAlertType(i.type));
  const otherItems = items.filter(i => !isAlertType(i.type));

  const renderItem = ({ item }: { item: any }) => {
    const unread = !item.isRead;
    return (
      <TouchableOpacity onPress={() => markAsRead(item)} style={[styles.item, unread && styles.unreadItem]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, unread && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={alertItems}
        keyExtractor={(i) => `${i.id || i.createdAt}_alert`}
        renderItem={({ item }) => (
          <View style={styles.alertWrapper}>
            <Text style={styles.alertBadge}>ALERT</Text>
            <TouchableOpacity onPress={() => markAsRead(item)} style={[styles.alertItem, !item.isRead && styles.unreadAlert]}>
              <Text style={styles.alertTitle}>{item.title}</Text>
              <Text style={styles.alertMessage}>{item.message}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={null}
      />

      <View style={{ height: 8, backgroundColor: '#f0f0f0' }} />

      <FlatList
        data={otherItems}
        keyExtractor={(i) => i.id || i.createdAt}
        renderItem={renderItem}
        ListEmptyComponent={<View style={{ padding: 20 }}><Text>No notifications yet</Text></View>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
  },
  unreadItem: {
    backgroundColor: '#e9f2ff'
  },
  title: { fontWeight: '700', color: '#333' },
  unreadTitle: { color: '#0b61d6' },
  message: { color: '#555', marginTop: 6 },
  time: { marginTop: 8, color: '#999', fontSize: 12 },

  alertWrapper: { padding: 12, backgroundColor: '#fff' },
  alertBadge: { backgroundColor: '#ff3b30', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', fontWeight: '700', marginBottom: 8 },
  alertItem: { padding: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffd2d2' },
  unreadAlert: { backgroundColor: '#ffecec', borderColor: '#ffb6b6' },
  alertTitle: { fontWeight: '800', color: '#8b0000' },
  alertMessage: { marginTop: 6, color: '#5a0000' }
});

export default Notifications;
