import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from './src/services/api';

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
  onGoToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.post('/users/login', { email, password });
      onLoginSuccess(res.data.token);
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.error || err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Hero header */}
        <View style={[styles.hero, { height: Math.round(SCREEN_HEIGHT * 0.50

        ) }] }>
          <Text style={styles.brand}>Sagipero!</Text>
          <Text style={styles.subtitle}>Emergency Disaster Response App</Text>
        </View>

  {/* Login Card */}
  <View style={styles.card}>
          <View style={styles.inputRow}>
            <Feather name="user" size={18} color="#000" style={styles.icon} />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputRow}>
            <Feather name="lock" size={18} color="#000" style={styles.icon} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.rowBetween}>
            <TouchableOpacity style={styles.remember} onPress={() => setRemember(!remember)}>
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.forgot}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0b2545" />
            ) : (
              <Text style={styles.loginText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.createRow} onPress={onGoToRegister}>
            <Text style={styles.createText}>
              Don't have an account? <Text style={styles.createLink}>Click Here!</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* decorative shape removed per request */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#240f1eff' },
  container: {
    flex: 1,
    backgroundColor: '#0f1724',
    alignItems: 'center',
    borderRadius: 24,
  },
  hero: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 36,
    borderRadius: 24,
    alignItems: 'center',
    
  },
  brand: {
    marginTop: 80,
    fontSize: 46,
    fontWeight: '800',
    color: '#0b2545',
    letterSpacing: 1,
   
    
  },
  subtitle: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
  },
  card: {
    width: '90%',
    marginTop: -100,
    backgroundColor: 'rgba(120, 95, 80, 0.74)',
    borderRadius: 20,
    padding: 20,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 52,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
    color: '#000',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f1724',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  remember: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  checkboxChecked: {
    backgroundColor: '#fff',
  },
  checkmark: { color: '#0b2545', fontWeight: '700' },
  rememberText: { color: 'rgba(255,255,255,0.9)' },
  forgot: { color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline', fontSize: 13 },
  loginButton: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginText: { color: '#0b2545', fontWeight: '800' },
  createRow: { marginTop: 12, alignItems: 'center' },
  createText: { color: 'rgba(255,255,255,0.85)' },
  createLink: { color: '#e6e7ea', textDecorationLine: 'underline', fontWeight: '700' },

  // bottomShape removed
});

export default LoginScreen;
