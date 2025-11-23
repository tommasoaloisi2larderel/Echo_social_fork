import { fetchWithAuth } from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ECHO_COLOR } from '../../constants/colors';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();  
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = async () => {
    if (!content.trim()) {
      Alert.alert('Contenu requis', 'Veuillez écrire quelque chose avant de publier.');
      return;
    }

    if (content.length > 2000) {
      Alert.alert('Contenu trop long', 'Votre post ne peut pas dépasser 2000 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/posts/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contenu: content.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Erreur lors de la publication');
      }

      Alert.alert(
        'Post publié !',
        'Votre post a été publié avec succès.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Erreur publication post:', error);
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de publier le post. Réessayez plus tard.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau post</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={isSubmitting || !content.trim()}
          style={[
            styles.publishButton,
            (!content.trim() || isSubmitting) && styles.publishButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishButtonText}>Publier</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Quoi de neuf ? Partagez vos pensées..."
            placeholderTextColor="#999"
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={2000}
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.footer}>
            <Text style={styles.characterCount}>
              {content.length}/2000
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  publishButton: {
    backgroundColor: ECHO_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  inputContainer: {
    flex: 1,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    minHeight: 200,
    padding: 0,
  },
  footer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
  },
});

