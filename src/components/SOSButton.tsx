import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Alert, ActivityIndicator, Modal, TouchableWithoutFeedback, Animated, PanResponder, GestureResponderEvent } from 'react-native';
import * as Location from 'expo-location';
import { sendSOS, api as mobileApi } from '../services/api';

const LONG_PRESS_DURATION = 3000; // 3 seconds to hold for SOS

export const SOSButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;
  const [pressDuration, setPressDuration] = useState(0);
  const pressStartTime = useRef<number | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // check if user already has an active emergency and lock if so
    (async ()=>{
      try{
        const res = await mobileApi.get('/emergencies/latest');
        if(res && res.status === 200){ setLocked(true) }
      }catch(e){ /* ignore - no active emergency or not logged in */ }
    })();

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const handlePressIn = () => {
    if(locked || isLoading) return;
    
    pressStartTime.current = Date.now();
    setPressDuration(0);
    
    // Update progress bar every 50ms
    pressTimer.current = setInterval(() => {
      if (pressStartTime.current) {
        const elapsed = Date.now() - pressStartTime.current;
        const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
        setPressDuration(elapsed);
        Animated.timing(pressProgress, {
          toValue: progress,
          duration: 50,
          useNativeDriver: false
        }).start();
      }
    }, 50);
  };

  const handlePressOut = () => {
    if (pressTimer.current) {
      clearInterval(pressTimer.current);
      pressTimer.current = null;
    }
    
    const elapsed = pressStartTime.current ? Date.now() - pressStartTime.current : 0;
    
    // If held long enough, open selector
    if (elapsed >= LONG_PRESS_DURATION) {
      setSelectorVisible(true);
    } else {
      // Reset progress if released too early
      Animated.timing(pressProgress, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false
      }).start();
    }
    
    pressStartTime.current = null;
  };

  const [selectorVisible, setSelectorVisible] = useState(false);

  const sendWithType = async (type: 'MEDICAL' | 'FIRE' | 'FLOOD' | 'EARTHQUAKE') => {
    setSelectorVisible(false);
    setPendingType(type);
    setCancelModalVisible(true);
    setPressDuration(0);
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 0,
      useNativeDriver: false
    }).start();

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsLoading(true);
      setCancelModalVisible(false);
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for SOS functionality');
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const response: SOSResponse = await sendSOS({ latitude: location.coords.latitude, longitude: location.coords.longitude }, type);
        if (!response.success) throw new Error(response.message || 'Failed to send SOS');
        Alert.alert('Emergency Reported', 'Your emergency has been reported. Emergency responders have been notified and will respond as soon as possible.');
        setLocked(true);
      } catch (err) {
        console.error('Error in SOS send after countdown:', err);
        Alert.alert('Error', 'Failed to send SOS. Please try again.');
      } finally { 
        setIsLoading(false);
      }
    }, 5000);

    // provide a cancel function to stop the timer
    setCancelModalCancel(() => () => { cancelled = true; clearTimeout(timer); setCancelModalVisible(false); setPendingType(null); });
  };

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [pendingType, setPendingType] = useState(null as null | string);
  const [cancelModalCancel, setCancelModalCancel] = useState<null | (() => void)>(null);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          accessibilityLabel="sos-button"
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading || locked}
        >
          {isLoading ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.buttonText}>SENDING SOS...</Text>
            </>
          ) : (
            <>
              <Text style={styles.buttonText}>SOS</Text>
              <Text style={styles.instructionText}>Hold for {(LONG_PRESS_DURATION / 1000).toFixed(1)}s</Text>
            </>
          )}
          
          {/* Progress meter background */}
          <View style={styles.progressBackground}>
            <Animated.View 
              style={[
                styles.progressFill,
                {
                  width: pressProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
      {locked && <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FFF3CD', borderRadius: 6 }}><Text style={{ color: '#856404' }}>You have an active request. SOS is locked until it is resolved.</Text></View>}

      <Modal visible={selectorVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setSelectorVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Choose Emergency Type</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.tile, { backgroundColor: '#ffecec' }]} onPress={() => sendWithType('MEDICAL')}>
              <Text style={styles.tileIcon}>➕</Text>
              <Text style={styles.tileLabel}>Medical</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tile, { backgroundColor: '#fff4e6' }]} onPress={() => sendWithType('FIRE')}>
              <Text style={styles.tileIcon}>🔥</Text>
              <Text style={styles.tileLabel}>Fire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tile, { backgroundColor: '#e6f7ff' }]} onPress={() => sendWithType('FLOOD')}>
              <Text style={styles.tileIcon}>🌊</Text>
              <Text style={styles.tileLabel}>Flood</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tile, { backgroundColor: '#f0f0f0' }]} onPress={() => sendWithType('EARTHQUAKE')}>
              <Text style={styles.tileIcon}>🌐</Text>
              <Text style={styles.tileLabel}>Earthquake</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectorVisible(false)}><Text>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => { /* block background */ }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { padding: 16 }]}> 
              <Text style={styles.modalTitle}>Confirm SOS</Text>
              <Text style={{ marginTop: 8, color: '#333' }}>You are about to send an SOS for <Text style={{ fontWeight: '700' }}>{String(pendingType)}</Text>. You have 5 seconds to cancel.</Text>
              <Text style={{ marginTop: 12, color: '#b91c1c', fontWeight: '700' }}>Canceling a false SOS may result in account termination and legal consequences. Do not send false reports.</Text>
              <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity style={{ padding: 10 }} onPress={() => { if(cancelModalCancel) cancelModalCancel() }}><Text>Cancel SOS</Text></TouchableOpacity>
                <View style={{ padding: 10 }}><Text style={{ color: '#666' }}>Sending in 5s...</Text></View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

interface SOSResponse {
  success: boolean;
  message?: string;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
  },
  buttonDisabled: {
    backgroundColor: '#FF6666',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.9,
  },
  progressBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { position: 'absolute', left: 20, right: 20, top: '30%', backgroundColor: '#fff', padding: 16, borderRadius: 12, elevation: 6 },
  modalTitle: { fontWeight: '800', fontSize: 18, marginBottom: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  tile: { width: '48%', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  tileIcon: { fontSize: 28, marginBottom: 6 },
  tileLabel: { fontWeight: '700' },
  closeBtn: { marginTop: 8, padding: 10, alignItems: 'center' }
});
