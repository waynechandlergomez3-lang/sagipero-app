import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { api } from '../services/api';
import * as DocumentPicker from 'expo-document-picker';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface MedicalProfile {
  bloodType: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  medicalInfo: {
    conditions: string[];
    allergies: string[];
    medications: string[];
  };
}

import { RouteProp, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  MedicalProfile: { token: string };
};

type MedicalProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MedicalProfile'>;
type MedicalProfileScreenRouteProp = RouteProp<RootStackParamList, 'MedicalProfile'>;

type Props = {
  navigation: MedicalProfileScreenNavigationProp;
  route: MedicalProfileScreenRouteProp;
};

const MedicalProfileForm = ({ navigation, route }: Props) => {
  const { token } = route.params;
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<MedicalProfile>({
    bloodType: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    medicalInfo: {
      conditions: [],
      allergies: [],
      medications: []
    }
  });
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [commonConditions, setCommonConditions] = useState<any[]>([]);
  const [commonAllergies, setCommonAllergies] = useState<any[]>([]);
  const [specialCircumstances, setSpecialCircumstances] = useState<string[]>([]);
  const [uploadedIdName, setUploadedIdName] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<any | null>(null);

  useEffect(() => {
    // initial fetch on mount
    fetchProfile();
    fetchCommons();
    fetchDocuments();
    // also refetch when screen is focused
  }, []);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchProfile();
      fetchDocuments();
    }
  }, [isFocused]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/medical/documents', { headers: { Authorization: 'Bearer ' + token } });
      if (Array.isArray(res.data)) {
        const idDoc = res.data.find((d: any) => d.type === 'ID');
        if (idDoc) {
          setUploadedDoc(idDoc);
          // derive name from fileUrl
          try {
            const parts = idDoc.fileUrl.split('/');
            setUploadedIdName(parts[parts.length - 1]);
          } catch (e) {
            setUploadedIdName('uploaded_id');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const fetchProfile = async () => {
    try {
  const response = await api.get('/users/profile', {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      if (response.data) {
        setProfile({
          bloodType: response.data.bloodType || '',
          emergencyContact: {
            name: response.data.emergencyContactName || '',
            relationship: response.data.emergencyContactRelation || '',
            phone: response.data.emergencyContactPhone || ''
          },
          medicalInfo: {
            conditions: response.data.medicalConditions || [],
            allergies: response.data.allergies || [],
            medications: (response.data.medicalInfo && response.data.medicalInfo.medications) || []
          }
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load medical profile');
    }
  };

  const fetchCommons = async () => {
    try {
      const [condsRes, alRes] = await Promise.all([
        api.get('/medical/conditions', { headers: { Authorization: 'Bearer ' + token } }),
        api.get('/medical/allergies', { headers: { Authorization: 'Bearer ' + token } })
      ]);

  setCommonConditions(condsRes.data || []);
  setCommonAllergies(alRes.data || []);
    } catch (error) {
      console.error('Error fetching common lists:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(
        '/users/profile',
        {
          bloodType: profile.bloodType,
          emergencyContactName: profile.emergencyContact.name,
          emergencyContactRelation: profile.emergencyContact.relationship,
          emergencyContactPhone: profile.emergencyContact.phone,
          medicalConditions: profile.medicalInfo.conditions,
          allergies: profile.medicalInfo.allergies,
          specialCircumstances: specialCircumstances
        },
        {
          headers: { Authorization: 'Bearer ' + token }
        }
      );
      Alert.alert('Success', 'Medical profile updated successfully');
  // refresh the local form state so re-opening or staying on the screen shows saved values
  await fetchProfile();
  await fetchDocuments();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update medical profile');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (category: 'conditions' | 'allergies' | 'medications', item: string) => {
    if (!item.trim()) return;
    
    setProfile(prev => ({
      ...prev,
      medicalInfo: {
        ...prev.medicalInfo,
        [category]: [...prev.medicalInfo[category], item.trim()]
      }
    }));

    // Clear the input
    switch (category) {
      case 'conditions':
        setNewCondition('');
        break;
      case 'allergies':
        setNewAllergy('');
        break;
      case 'medications':
        setNewMedication('');
        break;
    }
  };

  const toggleFromCommon = (category: 'conditions' | 'allergies', item: string) => {
    setProfile(prev => {
      const exists = prev.medicalInfo[category].includes(item);
      return {
        ...prev,
        medicalInfo: {
          ...prev.medicalInfo,
          [category]: exists ? prev.medicalInfo[category].filter(i => i !== item) : [...prev.medicalInfo[category], item]
        }
      };
    });
  };

  const toggleSpecialCircumstance = (value: string) => {
    setSpecialCircumstances(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const uploadIdDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      // some DocumentPicker typings are loose across SDKs; guard with uri
      // @ts-ignore
      if (result && (result as any).uri) {
        // @ts-ignore
        const name = (result as any).name || 'document';
        // @ts-ignore
        const mime = (result as any).mimeType || 'application/octet-stream';
        setUploadedIdName(name);
        const formData = new FormData();
        // @ts-ignore - FormData file object for React Native
        formData.append('file', { uri: (result as any).uri, name, type: mime });
        formData.append('type', 'ID');

  const res = await fetch((api.defaults.baseURL || '').replace(/\/api$/, '') + '/medical/documents', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token
            // NOTE: do not set Content-Type here; let fetch set the multipart boundary
          },
          body: formData as any
        });
  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  const data = await res.json();
  Alert.alert('Uploaded', 'ID uploaded successfully');
  console.log('Upload response:', data);
  // refresh documents list and set the uploaded doc from server response if provided
  if (data && data.id) {
    // server returned new document object
    setUploadedDoc(data);
    try {
      const parts = (data.fileUrl || '').split('/');
      setUploadedIdName(parts[parts.length - 1] || name);
    } catch (e) { setUploadedIdName(name); }
    Alert.alert('Upload complete', 'ID uploaded and attached to your profile.');
  } else {
    await fetchDocuments();
  }
      }
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', 'Failed to upload ID document');
    }
  };

  const removeItem = (category: 'conditions' | 'allergies' | 'medications', index: number) => {
    setProfile(prev => ({
      ...prev,
      medicalInfo: {
        ...prev.medicalInfo,
        [category]: prev.medicalInfo[category].filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        {/* Blood Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blood Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={profile.bloodType}
              onValueChange={(value) => setProfile(prev => ({ ...prev, bloodType: value }))}
              style={styles.picker}
            >
              <Picker.Item label="Select Blood Type" value="" />
              {bloodTypes.map(type => (
                <Picker.Item key={type} label={type} value={type} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Emergency Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Contact Name"
            value={profile.emergencyContact.name}
            onChangeText={(value) => setProfile(prev => ({
              ...prev,
              emergencyContact: { ...prev.emergencyContact, name: value }
            }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Relationship"
            value={profile.emergencyContact.relationship}
            onChangeText={(value) => setProfile(prev => ({
              ...prev,
              emergencyContact: { ...prev.emergencyContact, relationship: value }
            }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={profile.emergencyContact.phone}
            keyboardType="phone-pad"
            onChangeText={(value) => setProfile(prev => ({
              ...prev,
              emergencyContact: { ...prev.emergencyContact, phone: value }
            }))}
          />
        </View>

        {/* Medical Conditions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Conditions</Text>
          <View style={styles.addItemContainer}>
            <TextInput
              style={[styles.input, styles.addItemInput]}
              placeholder="Add medical condition"
              value={newCondition}
              onChangeText={setNewCondition}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addItem('conditions', newCondition)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {/* Common conditions quick pick */}
          {commonConditions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
              {commonConditions.map((c) => {
                const name = (c && (c.name || c.label)) || String(c);
                const id = (c && (c.id || name)) || name;
                const selected = profile.medicalInfo.conditions.includes(name);
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => toggleFromCommon('conditions', name)}
                    style={[styles.quickPill, selected && styles.quickPillSelected]}
                  >
                    <Text style={{ color: selected ? '#fff' : '#333' }}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {profile.medicalInfo.conditions.map((condition, index) => (
            <View key={index} style={styles.itemContainer}>
              <Text style={styles.itemText}>{condition}</Text>
              <TouchableOpacity
                onPress={() => removeItem('conditions', index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Allergies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <View style={styles.addItemContainer}>
            <TextInput
              style={[styles.input, styles.addItemInput]}
              placeholder="Add allergy"
              value={newAllergy}
              onChangeText={setNewAllergy}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addItem('allergies', newAllergy)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {profile.medicalInfo.allergies.map((allergy, index) => (
            <View key={index} style={styles.itemContainer}>
              <Text style={styles.itemText}>{allergy}</Text>
              <TouchableOpacity
                onPress={() => removeItem('allergies', index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {/* Common allergies quick pick */}
        {commonAllergies.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
            {commonAllergies.map((a) => {
              const name = (a && (a.name || a.label)) || String(a);
              const id = (a && (a.id || name)) || name;
              const selected = profile.medicalInfo.allergies.includes(name);
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => toggleFromCommon('allergies', name)}
                  style={[styles.quickPill, selected && styles.quickPillSelected]}
                >
                  <Text style={{ color: selected ? '#fff' : '#333' }}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Medications</Text>
          <View style={styles.addItemContainer}>
            <TextInput
              style={[styles.input, styles.addItemInput]}
              placeholder="Add medication"
              value={newMedication}
              onChangeText={setNewMedication}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addItem('medications', newMedication)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {profile.medicalInfo.medications.map((medication, index) => (
            <View key={index} style={styles.itemContainer}>
              <Text style={styles.itemText}>{medication}</Text>
              <TouchableOpacity
                onPress={() => removeItem('medications', index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Medical Profile'}
          </Text>
        </TouchableOpacity>
        {/* Special circumstances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Circumstances</Text>
          {['PREGNANT', 'PWD', 'ELDERLY', 'CHILD', 'WITH_INFANT', 'NONE'].map((s) => (
            <TouchableOpacity key={s} onPress={() => toggleSpecialCircumstance(s)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginRight: 10, backgroundColor: specialCircumstances.includes(s) ? '#1a73e8' : '#fff' }} />
              <Text>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ID Upload (info only; actions moved to footer) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity Document</Text>
          {uploadedDoc ? (
            <View>
              {uploadedDoc.fileUrl ? (
                <Image source={{ uri: uploadedDoc.fileUrl }} style={styles.imagePreview} resizeMode="contain" />
              ) : null}
              <Text style={{ marginTop: 8 }}>{uploadedIdName}</Text>
              <Text style={{ color: uploadedDoc.verified ? '#28a745' : '#6c757d' }}>{uploadedDoc.verified ? 'Verified' : 'Pending verification'}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity style={[styles.addButton, { minWidth: 90, marginRight: 8 }]} onPress={() => {
                  try {
                    if (uploadedDoc.fileUrl) Linking.openURL(uploadedDoc.fileUrl);
                  } catch (e) {
                    Alert.alert('Error', 'Unable to open document');
                  }
                }}>
                  <Text style={styles.addButtonText}>View</Text>
                </TouchableOpacity>
                {uploadedDoc && uploadedDoc.id && (
                  <TouchableOpacity style={[styles.addButton, { minWidth: 90 }]} onPress={async () => {
                    try {
                      // attempt to delete if backend supports it
                      const res = await api.delete(`/medical/documents/${uploadedDoc.id}` , { headers: { Authorization: 'Bearer ' + token } });
                      Alert.alert('Removed', 'Document removed');
                      setUploadedDoc(null);
                      setUploadedIdName(null);
                    } catch (err) {
                      console.warn('Failed to delete document', err);
                      Alert.alert('Error', 'Could not remove document');
                    }
                  }}>
                    <Text style={styles.addButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <Text style={{ color: '#666' }}>No ID uploaded yet</Text>
          )}
        </View>
      </ScrollView>
      {/* Sticky footer with upload + save to avoid system UI overlap */}
      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.footerInner}>
          <TouchableOpacity style={[styles.addButton, { flex: 1, marginRight: 8 }]} onPress={uploadIdDocument}>
            <Text style={styles.addButtonText}>{uploadedIdName ? 'Replace ID' : 'Upload ID'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, { flex: 1 }]} onPress={handleSave} disabled={loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  addItemInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#1a73e8',
    padding: 12,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  removeButton: {
    padding: 5,
  },
  removeButtonText: {
    color: '#dc3545',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1a73e8',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  quickPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f1f1f1',
    marginRight: 8,
    marginBottom: 8,
  },
  quickPillSelected: {
    backgroundColor: '#1a73e8',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'transparent'
  },
  footerInner: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 6,
  }
  ,
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f4f4f4'
  }
});

export default MedicalProfileForm;
