import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from './src/services/api';
import RegistrationSuccess from './RegistrationSuccess';

const SIGNUP_URL = undefined;

export default function RegisterScreen({ onGoToLogin, onRegisterComplete }: { onGoToLogin?: () => void; onRegisterComplete?: (token: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const navigation: any = useNavigation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successToken, setSuccessToken] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name || !email || !address || !barangay || !phone || !password) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (!agree) {
      Alert.alert('Agreement Required', 'You must agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/users/signup', {
        name,
        email,
        address,
        barangay,
        phone,
        password,
      });
      // After successful registration navigate to the RegistrationSuccess screen
      // so the user sees the success UI; pass the token so Continue can log them in.
      try {
        // show inline success UI handled by this screen only
          setSuccessToken(res.data.token);
          setShowSuccess(true);
      } catch (e) {
        // fallback: if navigation isn't available, call onGoToLogin
        if (onGoToLogin) onGoToLogin();
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.error || err.message || 'Signup error');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = () => {
    // Placeholder: replace with real file picker (expo-document-picker or similar) later.
    // For now simulate choosing a file name so the UI shows the selected file.
    setUploadName('id.jpeg');
    Alert.alert('Browse', 'Simulated file selection: id.jpeg');
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={true}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => onGoToLogin && onGoToLogin()}>
        <Feather name="arrow-left" size={20} color="#0b2545" />
      </TouchableOpacity>
      <Text style={styles.title}>Create account</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Full Name :</Text>
        <View style={styles.inputRow}>
          <Feather name="user" size={16} color="#0b2545" style={styles.icon} />
          <TextInput style={styles.inputPill} placeholder="" value={name} onChangeText={setName} autoCapitalize="words" />
        </View>

        <Text style={styles.label}>Email :</Text>
        <View style={styles.inputRow}>
          <Feather name="mail" size={16} color="#0b2545" style={styles.icon} />
          <TextInput style={styles.inputPill} placeholder="" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <Text style={styles.label}>Address :</Text>
        <View style={styles.inputRow}>
          <Feather name="map-pin" size={16} color="#0b2545" style={styles.icon} />
          <TextInput style={styles.inputPill} placeholder="" value={address} onChangeText={setAddress} />
        </View>

        <Text style={styles.label}>Barangay :</Text>
        <View style={[styles.inputRow, styles.pickerRow]}>
          <Feather name="map" size={16} color="#0b2545" style={styles.icon} />
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={barangay} onValueChange={(v) => setBarangay(v)} style={styles.picker} itemStyle={{height:40}}>
              <Picker.Item label="Hagonoy Bulacan - Barangay 1" value="Barangay 1" />
              <Picker.Item label="Hagonoy Bulacan - Barangay 2" value="Barangay 2" />
              <Picker.Item label="Hagonoy Bulacan - Barangay 3" value="Barangay 3" />
              <Picker.Item label="Hagonoy Bulacan - Barangay 4" value="Barangay 4" />
              <Picker.Item label="Hagonoy Bulacan - Barangay 5" value="Barangay 5" />
            </Picker>
          </View>
        </View>

        <Text style={styles.label}>Contact Number :</Text>
        <View style={styles.inputRow}>
          <Feather name="phone" size={16} color="#0b2545" style={styles.icon} />
          <TextInput style={styles.inputPill} placeholder="" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        <Text style={styles.label}>Password :</Text>
        <View style={styles.inputRow}>
          <Feather name="lock" size={16} color="#0b2545" style={styles.icon} />
          <TextInput style={styles.inputPill} placeholder="" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        <Text style={[styles.label, { marginTop: 6 }]}>Upload ID</Text>
        <Text style={styles.helpText}>* Address must include id</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.browseButton} onPress={handleBrowse}>
            <Text style={styles.browseText}>Browse</Text>
          </TouchableOpacity>
          {uploadName ? (
            <View style={styles.fileChip}>
              <Feather name="file" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.fileName}>{uploadName}</Text>
            </View>
          ) : (
            <Text style={styles.noFile}>No file chosen</Text>
          )}
        </View>

        <View style={styles.checkboxRowCard}>
          <TouchableOpacity onPress={() => setAgree(!agree)} style={styles.checkboxTouchable}>
            <View style={[styles.checkboxBoxCard, agree && styles.checkboxCheckedCard]}>
              {agree && <Feather name="check" size={12} color="#0b2545" />}
            </View>
          </TouchableOpacity>
          <Text style={styles.checkboxLabelCard}>
            By creating an account you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, (!agree || loading) && styles.createButtonDisabled]}
          onPress={handleRegister}
          disabled={loading || !agree}
        >
          {loading ? <ActivityIndicator color="#0b2545" /> : <Text style={styles.createButtonText}>Create Account</Text>}
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {showSuccess && (
        <View style={styles.successOverlay} pointerEvents="box-none">
          <RegistrationSuccess token={successToken} onContinue={(t: string) => { setShowSuccess(false); if (onRegisterComplete) onRegisterComplete(t); }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 70,
    flexGrow: 1,
    backgroundColor: '#f7f7f8',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 24,
    paddingHorizontal: 18,
    paddingBottom: 50, // Extra bottom padding for better scrolling
  },
  title: {
    color: '#0b2545',
    fontSize: 25,
    marginTop: 30,
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  card: {
    width: '100%',
    backgroundColor: '#0f1724',
    borderRadius: 20,
    padding: 18,
    // subtle inner padding and shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 44,
  },
  icon: {
    marginRight: 10,
  },
  inputPill: {
    flex: 1,
    fontSize: 14,
    color: '#0b2545',
  },
  helpText: { color: '#94a3b8', fontSize: 11, marginBottom: 8 },
  uploadRow: { flexDirection: 'row', alignItems: 'center' },
  browseButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 12,
  },
  browseText: { color: '#e6e7ea', fontSize: 13 },
  noFile: { color: '#94a3b8' },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fileName: { color: '#fff', fontSize: 13 },
  disclaimer: { color: '#94a3b8', fontSize: 10, marginTop: 12 },
  createButton: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'center',
    width: '60%',
  },
  createButtonText: { color: '#0b2545', fontWeight: '700' },
  checkboxRowCard: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  checkboxTouchable: { marginRight: 10 },
  checkboxBoxCard: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheckedCard: { backgroundColor: '#fff' },
  checkboxLabelCard: { color: '#cbd5e1', flex: 1, fontSize: 12 },
  createButtonDisabled: { opacity: 0.5 },
  backButton: {
    position: 'absolute',
    left: 18,
    top: 0,
    zIndex: 10,
    
    backgroundColor: 'transparent',
    padding: 6,
    borderRadius: 8,
  },
  successOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  pickerRow: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 6, height: 44, alignItems: 'center' },
  pickerWrapper: { flex: 1, justifyContent: 'center' },
  picker: { width: '100%', color: '#0b2545' },
});
