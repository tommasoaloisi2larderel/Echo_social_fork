import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

interface JarvisTextInputProps {
  onComplete: (message: string, response: string) => void;
  onQuit: () => void;
}

const JarvisTextInput: React.FC<JarvisTextInputProps> = ({
  onComplete,
  onQuit,
}) => {
  const { makeAuthenticatedRequest } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendToJarvis = async () => {
    if (!message.trim()) {
      return;
    }

    setIsSending(true);
    
    try {
      console.log('📤 Envoi du message à Jarvis:', message);
      
      const response = await makeAuthenticatedRequest(
        'https://reseausocial-production.up.railway.app/jarvis/chat/?type=message',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            context: {},
          }),
        }
      );

      console.log('✅ Réponse HTTP reçue, status:', response.status);

      // Parser la réponse JSON
      const data = await response.json();
      console.log('✅ Données JSON parsées:', data);

      if (data && data.success && data.response) {
        onComplete(message, data.response);
        setMessage(''); // Effacer le champ après envoi réussi
      } else {
        console.error('❌ Réponse invalide:', data);
        Alert.alert('Erreur', 'Impossible de traiter votre message');
      }
    } catch (err) {
      console.error('❌ Erreur lors de l\'envoi:', err);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chatContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Parlez à Jarvis..."
          placeholderTextColor="rgba(10, 145, 104, 0.5)"
          value={message}
          onChangeText={setMessage}
          multiline
          autoFocus
          editable={!isSending}
          onSubmitEditing={sendToJarvis}
          returnKeyType="send"
        />
        
        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={sendToJarvis}
          activeOpacity={0.8}
          disabled={!message.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            Platform.OS === 'ios' ? (
              <SymbolView 
                name="arrow.up.circle.fill" 
                size={22} 
                tintColor="white" 
                type="hierarchical" 
              />
            ) : (
              <Ionicons 
                name="send" 
                size={22} 
                color="white" 
              />
            )
          )}
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={styles.quitButton}
        onPress={onQuit}
        activeOpacity={0.8}
        disabled={isSending}
      >
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="xmark.circle.fill" 
            size={20} 
            tintColor="rgba(255, 59, 48, 0.8)" 
            type="hierarchical" 
          />
        ) : (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color="rgba(255, 59, 48, 0.8)" 
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 35,
    marginHorizontal: 10,
    marginBottom: 5,
    paddingHorizontal: 15,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 12,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#444',
    fontWeight: '400',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(10, 145, 104, 0.3)',
  },
  quitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255, 59, 48, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
});

export default JarvisTextInput;