import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export default function ResponderVehicles({ navigation }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ plateNumber: '', model: '', color: '', active: 'active' });

  const load = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await api.get('/vehicles', { headers: { Authorization: `Bearer ${token}` } });
      // Filter to my vehicles if many
      setVehicles((res.data || []).filter((v: any) => true));
    } catch (e) {
      console.warn('Failed to load vehicles', e);
      Alert.alert('Error', 'Failed to load vehicles');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ plateNumber: '', model: '', color: '', active: 'active' }); setModalOpen(true); };
  const openEdit = (it: any) => { setEditing(it); setForm({ plateNumber: it.plateNumber || '', model: it.model || '', color: it.color || '', active: it.active ? 'active' : 'inactive' }); setModalOpen(true); };

  const save = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const payload: any = { plateNumber: form.plateNumber, model: form.model, color: form.color, active: form.active === 'active' };
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Saved', 'Vehicle updated');
      } else {
        await api.post('/vehicles', payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Created', 'Vehicle created');
      }
      setModalOpen(false);
      load();
    } catch (e) { console.warn('Save failed', e); Alert.alert('Error', 'Failed to save'); }
  };

  const remove = async (id: string) => {
    Alert.alert('Confirm', 'Delete vehicle?', [ { text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { const token = await AsyncStorage.getItem('userToken'); await api.delete(`/vehicles/${id}`, { headers: { Authorization: `Bearer ${token}` } }); load(); } catch (e) { console.warn(e); Alert.alert('Error', 'Delete failed'); }
    } } ]);
  };

  const toggle = async (v: any) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await api.put(`/vehicles/${v.id}`, { active: !v.active }, { headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch (e) { console.warn(e); Alert.alert('Error', 'Failed to update availability'); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}><Text style={{ color: '#fff' }}>Add</Text></TouchableOpacity>
      </View>
      <FlatList data={vehicles} keyExtractor={i => i.id} renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.plateNumber || '—'}</Text>
            <Text style={styles.meta}>{item.model || 'Unknown'} • {item.color || ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ marginBottom: 8 }}>{item.active ? 'Available' : 'Unavailable'}</Text>
            <TouchableOpacity style={styles.smallBtn} onPress={() => toggle(item)}><Text>{item.active ? 'Mark Unavailable' : 'Mark Available'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => openEdit(item)}><Text>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => remove(item.id)}><Text style={{ color: '#b71c1c' }}>Delete</Text></TouchableOpacity>
          </View>
        </View>
      )} refreshing={loading} onRefresh={load} />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
            <TextInput placeholder="Plate Number" value={form.plateNumber} onChangeText={(t)=>setForm(s=>({ ...s, plateNumber: t }))} style={styles.input} />
            <TextInput placeholder="Model" value={form.model} onChangeText={(t)=>setForm(s=>({ ...s, model: t }))} style={styles.input} />
            <TextInput placeholder="Color" value={form.color} onChangeText={(t)=>setForm(s=>({ ...s, color: t }))} style={styles.input} />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity onPress={() => { setModalOpen(false); }} style={styles.modalBtn}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} style={[styles.modalBtn, styles.modalPrimary]}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#f6f8fb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  addBtn: { backgroundColor: '#1a73e8', padding: 8, borderRadius: 8 },
  item: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  name: { fontWeight: '700' },
  meta: { color: '#666', fontSize: 12 },
  smallBtn: { marginTop: 6, padding: 6, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '92%', backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8, marginBottom: 8 },
  modalBtn: { padding: 8 },
  modalPrimary: { backgroundColor: '#1a73e8', padding: 8, borderRadius: 8 }
});
