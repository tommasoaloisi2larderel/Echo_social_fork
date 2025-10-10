import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export const CreateGroupModal = ({ visible, onClose, onCreate }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du groupe est obligatoire');
      return;
    }

    setLoading(true);
    try {
      await onCreate(name, description);
      // Réinitialiser les champs
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Erreur création groupe modal:', error);
      Alert.alert('Erreur', 'Impossible de créer le groupe');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Créer un groupe</Text>
              <TouchableOpacity onPress={handleClose} disabled={loading}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Icône du groupe */}
              <View style={styles.iconContainer}>
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={50} color="rgba(10, 145, 104, 1)" />
                </View>
              </View>

              {/* Nom du groupe */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Nom du groupe <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Projet Echo, Club Running..."
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                  editable={!loading}
                />
                <Text style={styles.charCount}>{name.length}/50</Text>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Décrivez l'objectif de ce groupe..."
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                  editable={!loading}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/200</Text>
              </View>

              {/* Info */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.infoText}>
                  Vous serez le propriétaire du groupe et pourrez inviter des membres.
                </Text>
              </View>
            </ScrollView>

            {/* Boutons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={loading || !name.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Créer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  groupIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: 'red',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    paddingTop: 15,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    marginLeft: 10,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

