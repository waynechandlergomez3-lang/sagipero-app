import React, { useState, useEffect, useRef } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Pressable,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api as apiClient } from '../services/api'

export default function ConcernedCitizenScreen({ navigation }: { navigation: any }) {
  const [token, setToken] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [mediaCaption, setMediaCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [tab, setTab] = useState<'media' | 'location'>('media')

  // Location sharing states
  const [location, setLocation] = useState<any>(null)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [reason, setReason] = useState('')
  const [sharingLocation, setSharingLocation] = useState(false)
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    const loadToken = async () => {
      try {
        const t = await AsyncStorage.getItem('userToken')
        setToken(t)
      } catch (e) {
        console.error('Failed to load token', e)
      }
    }
    loadToken()
  }, [])

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled) {
        setSelectedMedia(result.assets[0])
        setMediaCaption('')
      }
    } catch (err) {
      console.error('Error picking image:', err)
      Alert.alert('Error', 'Failed to pick media')
    }
  }

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled) {
        setSelectedMedia(result.assets[0])
        setMediaCaption('')
      }
    } catch (err) {
      console.error('Error taking photo:', err)
      Alert.alert('Error', 'Failed to take photo')
    }
  }

  const uploadMedia = async () => {
    if (!selectedMedia || !token) {
      Alert.alert('Error', 'Please select media and ensure you are logged in')
      return
    }

    if (!mediaCaption.trim()) {
      Alert.alert('Error', 'Please add a description for your media')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      const fileName = selectedMedia.uri.split('/').pop() || 'media.jpg'
      const mimeType = selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg'

      formData.append('file', {
        uri: selectedMedia.uri,
        name: fileName,
        type: mimeType,
      } as any)

      formData.append('caption', mediaCaption)
      formData.append('mediaType', selectedMedia.type === 'video' ? 'video' : 'photo')

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          const progress = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
          )
          setUploadProgress(progress)
        },
      }

      const response = await apiClient.post('/media/upload', formData, config)

      if (response.status === 200 || response.status === 201) {
        Alert.alert('Success', 'Media uploaded successfully! Admin will review it.')
        setSelectedMedia(null)
        setMediaCaption('')
        setUploadProgress(0)
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Failed to upload media'
      Alert.alert('Upload Failed', errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const shareLocation = async () => {
    if (!token) {
      Alert.alert('Error', 'You must be logged in to share location')
      return
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for sharing your location')
      return
    }

    setLoadingLocation(true)

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required')
        setLoadingLocation(false)
        return
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const { latitude, longitude } = currentLocation.coords

      // Save location to backend
      setSharingLocation(true)
      const locationResponse = await apiClient.put(
        '/users/location',
        { latitude, longitude },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setLocation({ latitude, longitude })

      // Also create a notification/report for admin
      // This will be visible on admin dashboard
      if (latitude && longitude) {
        try {
          await apiClient.post(
            '/notifications/citizen-location-share',
            {
              latitude,
              longitude,
              reason: reason.trim(),
              timestamp: new Date().toISOString(),
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        } catch (err) {
          console.warn('Failed to create location share notification:', err)
          // Don't fail the whole operation if notification fails
        }
      }

      setSharingSuccess(true)
      setSuccessMessage(`Location shared successfully!\nLat: ${latitude.toFixed(4)}, Long: ${longitude.toFixed(4)}\n\nReason: ${reason}`)
      setReason('')

      setTimeout(() => {
        setSharingSuccess(false)
      }, 5000)
    } catch (err: any) {
      console.error('Location share error:', err)
      Alert.alert('Error', 'Failed to share location: ' + err.message)
    } finally {
      setLoadingLocation(false)
      setSharingLocation(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1a73e8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Concerned Citizen</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'media' && styles.tabButtonActive]}
          onPress={() => setTab('media')}
        >
          <Ionicons
            name="camera"
            size={20}
            color={tab === 'media' ? '#1a73e8' : '#999'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, tab === 'media' && styles.tabTextActive]}>
            Submit Media
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, tab === 'location' && styles.tabButtonActive]}
          onPress={() => setTab('location')}
        >
          <Ionicons
            name="location"
            size={20}
            color={tab === 'location' ? '#1a73e8' : '#999'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, tab === 'location' && styles.tabTextActive]}>
            Share Location
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Tab */}
        {tab === 'media' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Submit Citizen Media</Text>
            <Text style={styles.sectionDescription}>
              Help us by submitting photos or videos of incidents in your area. Your contributions help emergency responders and administrators stay informed.
            </Text>

            {selectedMedia ? (
              <View style={styles.mediaPreview}>
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={() => setSelectedMedia(null)}
                >
                  <Ionicons name="close-circle" size={32} color="#f44336" />
                </TouchableOpacity>

                <View style={styles.mediaInfo}>
                  <Text style={styles.mediaType}>
                    {selectedMedia.type === 'video' ? '🎥 Video' : '📷 Photo'}
                  </Text>
                  <Text style={styles.mediaSize}>
                    {(selectedMedia.fileSize
                      ? (selectedMedia.fileSize / 1024 / 1024).toFixed(2)
                      : '?.?'
                    ) + ' MB'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.mediaPickerContainer}>
                <Ionicons name="image" size={48} color="#ccc" />
                <Text style={styles.mediaPickerText}>No media selected</Text>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={20} color="#1a73e8" />
                <Text style={styles.buttonText}>Choose Media</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={20} color="#1a73e8" />
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>

            {selectedMedia && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe what you observed..."
                  placeholderTextColor="#999"
                  value={mediaCaption}
                  onChangeText={setMediaCaption}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {mediaCaption.length}/500
                </Text>
              </View>
            )}

            {uploading && (
              <View style={styles.uploadProgress}>
                <ActivityIndicator size="large" color="#1a73e8" />
                <Text style={styles.uploadProgressText}>
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                (!selectedMedia || uploading) && styles.buttonDisabled,
              ]}
              onPress={uploadMedia}
              disabled={!selectedMedia || uploading}
            >
              {uploading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.buttonTextWhite}>Uploading...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.buttonTextWhite}>Submit Media</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Location Tab */}
        {tab === 'location' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share Your Location</Text>
            <Text style={styles.sectionDescription}>
              Share your current location with administrators so they can be aware of situations in your area. Your location data helps coordinate emergency response.
            </Text>

            {sharingSuccess && (
              <View style={styles.successCard}>
                <View style={styles.successHeader}>
                  <Ionicons name="checkmark-circle" size={32} color="#4caf50" />
                  <Text style={styles.successTitle}>Location Shared!</Text>
                </View>
                <Text style={styles.successMessage}>{successMessage}</Text>
              </View>
            )}

            {location && (
              <View style={styles.locationCard}>
                <Text style={styles.locationTitle}>Current Location</Text>
                <View style={styles.locationCoords}>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Latitude</Text>
                    <Text style={styles.coordValue}>
                      {location.latitude.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Longitude</Text>
                    <Text style={styles.coordValue}>
                      {location.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Reason for Sharing *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Reporting unusual activity, requesting assistance, monitoring situation..."
                placeholderTextColor="#999"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                maxLength={300}
              />
              <Text style={styles.charCount}>{reason.length}/300</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                (loadingLocation || sharingLocation) && styles.buttonDisabled,
              ]}
              onPress={shareLocation}
              disabled={loadingLocation || sharingLocation}
            >
              {loadingLocation || sharingLocation ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.buttonTextWhite}>Getting Location...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="location" size={20} color="#fff" />
                  <Text style={styles.buttonTextWhite}>Share Location</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#1a73e8" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Privacy Notice</Text>
                <Text style={styles.infoText}>
                  Your location data will only be visible to authorized administrators and will be used solely for emergency response coordination.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1a73e8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: '#1a73e8',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: 300,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
  },
  mediaInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaType: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  mediaSize: {
    color: '#fff',
    fontSize: 12,
  },
  mediaPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#eee',
    borderStyle: 'dashed',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mediaPickerText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#1a73e8',
    width: '100%',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a73e8',
  },
  buttonTextWhite: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  uploadProgress: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  successCard: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 8,
  },
  successMessage: {
    fontSize: 13,
    color: '#2e7d32',
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 12,
  },
  locationCoords: {
    flexDirection: 'row',
    gap: 12,
  },
  coordItem: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
  },
  coordLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Courier New',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    marginTop: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#0d47a1',
    lineHeight: 18,
  },
})
