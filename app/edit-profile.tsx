import DefaultAvatar from '@/components/DefaultAvatar';
import { ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { storage } from '../utils/storage';
import { useUserProfile } from '@/contexts/UserProfileContext'; 

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

export default function EditProfileScreen() {
  const { user, makeAuthenticatedRequest,updateUser, reloadUser   } = useAuth();
  const { clearCache } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: (user as any)?.email || '',
    first_name: (user as any)?.first_name || '',
    last_name: (user as any)?.last_name || '',
    surnom: (user as any)?.surnom || '',
    bio: (user as any)?.bio || '',
    nationalite: (user as any)?.nationalite || '',
    date_naissance: (user as any)?.date_naissance || '',
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à votre caméra.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir depuis la galerie', onPress: pickImage },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          formDataToSend.append(key, value);
        }
      });

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formDataToSend.append('photo_profil', {
          uri: imageUri,
          name: filename,
          type,
        } as any);
      }

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/auth/profile/`,
        {
          method: 'PATCH',
          body: formDataToSend,
        }
      );

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update user in storage so it persists
        await storage.setItemAsync("user", JSON.stringify(updatedUser));
        await updateUser(updatedUser);    
        await clearCache();
        await reloadUser()
        Alert.alert('Succès', 'Votre profil a été mis à jour avec succès !', [
          { text: 'OK', onPress: () => {
            // Navigate back and the profile will refresh from storage
            router.back();
          }}
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le profil');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const currentPhotoUri = imageUri || (user as any)?.photo_profil_url;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['rgba(240, 250, 248, 1)', 'rgba(200, 235, 225, 1)']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={ECHO_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={ECHO_COLOR} />
            ) : (
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={showImageOptions} style={styles.avatarContainer}>
            {currentPhotoUri ? (
              <Image source={{ uri: currentPhotoUri }} style={styles.avatar} />
            ) : (
              <DefaultAvatar name={formData.username || 'User'} size={120} />
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <InputField
            label="Nom d'utilisateur"
            value={formData.username}
            onChangeText={(text) => setFormData({ ...formData, username: text })}
            icon="person"
            editable={false}
            hint="Le nom d'utilisateur ne peut pas être modifié"
          />

          <InputField
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputField
            label="Surnom"
            value={formData.surnom}
            onChangeText={(text) => setFormData({ ...formData, surnom: text })}
            icon="heart"
            placeholder="Votre surnom"
          />

          <InputField
            label="Prénom"
            value={formData.first_name}
            onChangeText={(text) => setFormData({ ...formData, first_name: text })}
            icon="person-outline"
            placeholder="Votre prénom"
          />

          <InputField
            label="Nom"
            value={formData.last_name}
            onChangeText={(text) => setFormData({ ...formData, last_name: text })}
            icon="person-outline"
            placeholder="Votre nom"
          />

          <InputField
            label="Bio"
            value={formData.bio}
            onChangeText={(text) => setFormData({ ...formData, bio: text })}
            icon="document-text"
            placeholder="Parlez-nous de vous..."
            multiline
            numberOfLines={4}
          />

          <InputField
            label="Nationalité"
            value={formData.nationalite}
            onChangeText={(text) => setFormData({ ...formData, nationalite: text })}
            icon="flag"
            placeholder="Votre nationalité"
          />

          <InputField
            label="Date de naissance"
            value={formData.date_naissance}
            onChangeText={(text) => setFormData({ ...formData, date_naissance: text })}
            icon="calendar"
            placeholder="AAAA-MM-JJ"
            hint="Format: AAAA-MM-JJ (ex: 1990-01-15)"
          />
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  hint?: string;
}

function InputField({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  hint,
}: InputFieldProps) {
  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputLabelRow}>
        <Ionicons name={icon} size={18} color={ECHO_COLOR} />
        <Text style={styles.inputLabel}>{label}</Text>
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
      {hint && <Text style={styles.inputHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1b5e20',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ECHO_COLOR,
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ECHO_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
  },
  formSection: {
    gap: 16,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  footerSpace: {
    height: 40,
  },
});