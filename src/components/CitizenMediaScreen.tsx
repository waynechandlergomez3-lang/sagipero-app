import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api as apiClient } from '../services/api';

interface MediaItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  status: string;
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
}

export default function CitizenMediaScreen({ navigation }: { navigation: any }) {
  const [token, setToken] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const fileRef = useRef<any>(null);

  React.useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('userToken');
      setToken(savedToken);
      if (savedToken) {
        fetchMyMedia(savedToken);
      }
    } catch (err) {
      console.error('Failed to load token', err);
    }
  };

  const fetchMyMedia = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/media/my-submissions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setMedia(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch media', err);
      Alert.alert('Error', 'Failed to load your submissions');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        fileRef.current = result.assets[0];
        setMediaType('photo');
        setCaption('');
        setModalVisible(true);
      }
    } catch (err) {
      console.error('Image picker error', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      if (!result.canceled) {
        fileRef.current = result.assets[0];
        setMediaType('video');
        setCaption('');
        setModalVisible(true);
      }
    } catch (err) {
      console.error('Video picker error', err);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const uploadMedia = async () => {
    if (!fileRef.current || !token) {
      Alert.alert('Error', 'Missing file or authentication');
      return;
    }

    setUploading(true);
    try {
      // In production, upload to cloud storage (S3, Firebase, etc.) first
      // For now, using the file URI as mediaUrl (assumes app handles local file serving)
      const mediaUrl = fileRef.current.uri;

      const res = await apiClient.post(
        '/media',
        {
          mediaUrl,
          mediaType,
          caption: caption || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Media submitted for review');
      setModalVisible(false);
      setCaption('');
      fileRef.current = null;
      
      // Refresh media list
      await fetchMyMedia(token);
    } catch (err: any) {
      console.error('Upload error', err);
      Alert.alert('Error', 'Failed to upload media');
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (id: string) => {
    Alert.alert(
      'Delete Submission?',
      'Are you sure you want to delete this submission?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/media/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              Alert.alert('Success', 'Submission deleted');
              fetchMyMedia(token!);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete submission');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '#4CAF50';
      case 'REJECTED':
        return '#F44336';
      case 'PENDING':
      default:
        return '#FFC107';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'checkmark-circle';
      case 'REJECTED':
        return 'close-circle';
      case 'PENDING':
      default:
        return 'time';
    }
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => (
    <View style={styles.mediaCard}>
      <TouchableOpacity
        style={styles.mediaPreview}
        onPress={() => setSelectedMedia(item)}
      >
        {item.mediaType === 'photo' ? (
          <Image
            source={{ uri: item.mediaUrl }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle" size={48} color="#fff" />
            <Text style={styles.videoLabel}>Video</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons
            name={getStatusIcon(item.status) as any}
            size={14}
            color="#fff"
          />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.mediaInfo}>
        {item.caption && (
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleDateString()} •{' '}
          {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        {item.notes && (
          <View style={styles.reviewNotes}>
            <Text style={styles.reviewNotesLabel}>Admin Notes:</Text>
            <Text style={styles.reviewNotesText}>{item.notes}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => deleteMedia(item.id)}
      >
        <Ionicons name="trash" size={18} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Submit Media</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload buttons */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Share Emergency Evidence</Text>
          <Text style={styles.sectionSubtitle}>
            Help emergency responders by submitting photos or videos of the situation
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickImage}
              disabled={uploading}
            >
              <Ionicons name="camera" size={24} color="#1a73e8" />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickVideo}
              disabled={uploading}
            >
              <Ionicons name="videocam" size={24} color="#1a73e8" />
              <Text style={styles.uploadButtonText}>Take Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My submissions */}
        <View style={styles.submissionsSection}>
          <View style={styles.submissionHeader}>
            <Text style={styles.sectionTitle}>My Submissions</Text>
            {media.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{media.length}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1a73e8" style={styles.loader} />
          ) : media.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="image-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No submissions yet</Text>
              <Text style={styles.emptySubtext}>
                Submit photos or videos to help emergency responders
              </Text>
            </View>
          ) : (
            <FlatList
              data={media}
              renderItem={renderMediaItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Upload modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Caption</Text>
            <TouchableOpacity
              onPress={uploadMedia}
              disabled={uploading}
            >
              <Text style={[styles.modalSubmitText, uploading && { opacity: 0.5 }]}>
                {uploading ? 'Uploading...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {fileRef.current && (
              <Image
                source={{ uri: fileRef.current.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}

            <View style={styles.captionInput}>
              <Text style={styles.inputLabel}>Caption (Optional)</Text>
              <View style={styles.textInputWrapper}>
                <Text style={styles.charCount}>
                  {caption.length}/200
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!selectedMedia} transparent animationType="fade">
        <View style={styles.detailOverlay}>
          <TouchableOpacity
            style={styles.detailClose}
            onPress={() => setSelectedMedia(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedMedia && (
            <View style={styles.detailContent}>
              <Image
                source={{ uri: selectedMedia.mediaUrl }}
                style={styles.detailImage}
                resizeMode="contain"
              />
              {selectedMedia.caption && (
                <Text style={styles.detailCaption}>{selectedMedia.caption}</Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  uploadSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a73e8',
    marginTop: 8,
  },
  submissionsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  countBadge: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  mediaCard: {
    marginBottom: 12,
  },
  mediaPreview: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    height: 200,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  videoLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  mediaInfo: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  caption: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  reviewNotes: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reviewNotesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  reviewNotesText: {
    fontSize: 12,
    color: '#888',
  },
  deleteBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 6,
  },
  separator: {
    height: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#999',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a73e8',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 20,
  },
  captionInput: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInputWrapper: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1000,
  },
  detailContent: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  detailImage: {
    width: '100%',
    height: 500,
  },
  detailCaption: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});
