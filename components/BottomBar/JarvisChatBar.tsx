import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface JarvisChatBarProps {
  onSendMessage: (message: string) => void;
  onQuit: () => void;
}

const JarvisChatBar: React.FC<JarvisChatBarProps> = ({
  onSendMessage,
  onQuit,
}) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chatContainer}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Écrire à Jarvis..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            { opacity: message.trim() ? 1 : 0.5 }
          ]}
          onPress={handleSend}
          disabled={!message.trim()}
          activeOpacity={0.8}
        >
          {Platform.OS === 'ios' ? (
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
          )}
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={styles.quitButton}
        onPress={onQuit}
        activeOpacity={0.8}
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
    backgroundColor: "rgba(255, 255, 255, 0)", // Background semi-transparent pour la visibilité
    borderRadius: 35,
    marginHorizontal: 10,
    marginBottom: 5,
    paddingHorizontal: 15,
    paddingVertical: 8, // Réduit pour une barre plus fine
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 3,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#444",
    fontWeight: "400",
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
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

export default JarvisChatBar;
