import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export default function ResponderInventory({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', quantity: '1', unit: '', notes: '', available: 'available' });

  const load = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await api.get('/inventory', { headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data || []);
    } catch (e) {
      console.warn('Failed to load inventory', e);
      Alert.alert('Error', 'Failed to load inventory');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', sku: '', quantity: '1', unit: '', notes: '', available: 'available' }); setModalOpen(true); };
  const openEdit = (it: any) => { setEditing(it); setForm({ name: it.name || '', sku: it.sku || '', quantity: String(it.quantity || 0), unit: it.unit || '', notes: it.notes || '', available: it.available ? 'available' : 'unavailable' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name) return Alert.alert('Validation', 'Name required');
    try {
      const token = await AsyncStorage.getItem('userToken');
      const payload: any = { name: form.name, sku: form.sku, quantity: Number(form.quantity || 0), unit: form.unit, notes: form.notes, available: form.available === 'available' };
      if (editing) {
        await api.put(`/inventory/${editing.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Saved', 'Item updated');
      } else {
        await api.post('/inventory', payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Created', 'Item created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      console.warn('Save failed', e);
      Alert.alert('Error', 'Failed to save');
    }
  };

  const remove = async (id: string) => {
    Alert.alert('Confirm', 'Delete item?', [ { text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { const token = await AsyncStorage.getItem('userToken'); await api.delete(`/inventory/${id}`, { headers: { Authorization: `Bearer ${token}` } }); load(); } catch (e) { console.warn(e); Alert.alert('Error', 'Delete failed'); }
    } } ]);
  };

  const toggle = async (it: any) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await api.put(`/inventory/${it.id}`, { available: !it.available }, { headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch (e) { console.warn(e); Alert.alert('Error', 'Failed to update availability'); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}><Text style={{ color: '#fff' }}>Add</Text></TouchableOpacity>
      </View>
      <FlatList data={items} keyExtractor={i => i.id} renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>Qty: {item.quantity} • {item.unit || 'unit'}</Text>
            <Text style={styles.meta}>{item.sku ? `SKU: ${item.sku}` : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ marginBottom: 8 }}>{item.available ? 'Available' : 'Unavailable'}</Text>
            <TouchableOpacity style={styles.smallBtn} onPress={() => toggle(item)}><Text>{item.available ? 'Mark Unavailable' : 'Mark Available'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => openEdit(item)}><Text>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => remove(item.id)}><Text style={{ color: '#b71c1c' }}>Delete</Text></TouchableOpacity>
          </View>
        </View>
      )} refreshing={loading} onRefresh={load} />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>{editing ? 'Edit Item' : 'Add Item'}</Text>
            <TextInput placeholder="Name" value={form.name} onChangeText={(t)=>setForm(s=>({ ...s, name: t }))} style={styles.input} />
            <TextInput placeholder="SKU" value={form.sku} onChangeText={(t)=>setForm(s=>({ ...s, sku: t }))} style={styles.input} />
            <TextInput placeholder="Quantity" keyboardType="numeric" value={form.quantity} onChangeText={(t)=>setForm(s=>({ ...s, quantity: t }))} style={styles.input} />
            <TextInput placeholder="Unit" value={form.unit} onChangeText={(t)=>setForm(s=>({ ...s, unit: t }))} style={styles.input} />
            <TextInput placeholder="Notes" value={form.notes} onChangeText={(t)=>setForm(s=>({ ...s, notes: t }))} style={styles.input} />
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
