import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
 
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';



type RouteParams = { token?: string };
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export default function RegistrationSuccess({ onContinue, token: propToken }: { onContinue: (token: string) => void; token?: string | null }) {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as RouteParams | undefined;
  const token = propToken ?? params?.token;

  const handleContinue = () => {
    if (token) onContinue(token);
    // App will react to token save and navigate to main; simply goBack if possible
    try { (navigation as any).navigate('Main'); } catch (e) { /* ignore */ }
  };

  return (
    <SafeAreaView style={styles.safe}>
    <View style={[styles.hero, { height: Math.round(SCREEN_HEIGHT * 0.45

    
            ) }] }>
                <Text style={styles.subtitle}>Welcome to</Text>
              <Text style={styles.brand}>Sagipero</Text>
              
            </View>

      <View style={styles.body}>
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={34} color="#fff" />
          </View>
        </View>
        <Text style={styles.message}>Your account has been{`\n`}successfully created.</Text>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  hero: { backgroundColor: '#0f1724', paddingTop: 40, paddingBottom: 28, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  welcome: { color: '#cbd5e1', fontSize: 12, marginBottom: 6 },
  brand: { color: '#fff', fontSize: 44, fontWeight: '800' },
  subtitle: { color: '#fff', fontSize: 25, fontWeight: '400' , marginTop: 80, marginBottom: 6 },
  body: { flex: 1, alignItems: 'center', paddingTop: 36 },
  checkWrap: { marginBottom: 24 },
  checkCircle: { width: 150, height: 150, borderRadius: 80, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 6,marginTop:-100,marginBottom:80 },
  message: { textAlign: 'center', marginTop: 8, color: '#111827', fontSize: 20, marginBottom: 28, fontWeight: '800' },
  button: { backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 999, width: '70%', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
