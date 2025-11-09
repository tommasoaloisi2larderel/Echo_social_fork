import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface WritingBubbleProps {
  chatText: string;
  onChangeText: (text: string) => void;
  onSendMessage: () => void;
  onCancel: () => void;
}

const WritingBubble: React.FC<WritingBubbleProps> = ({
  chatText,
  onChangeText,
  onSendMessage,
  onCancel,
}) => {
  const inputRef = useRef<TextInput>(null);

  // Auto-focus when component mounts
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <View style={styles.container}>
        <View style={styles.bubble}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={chatText}
            onChangeText={onChangeText}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#999"
            multiline
            maxLength={5000}
          />
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView 
                  name="xmark.circle.fill" 
                  size={24} 
                  tintColor="#666" 
                  type="hierarchical" 
                />
              ) : (
                <Ionicons name="close-circle" size={24} color="#666" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendButton,
                !chatText.trim() && styles.sendButtonDisabled
              ]}
              onPress={onSendMessage}
              disabled={!chatText.trim()}
              activeOpacity={0.8}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView 
                  name="arrow.up.circle.fill" 
                  size={28} 
                  tintColor={chatText.trim() ? "rgba(10, 145, 104, 1)" : "#ccc"} 
                  type="hierarchical" 
                />
              ) : (
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={chatText.trim() ? "rgba(10, 145, 104, 1)" : "#ccc"} 
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  container: {
    paddingHorizontal: 16,
  },
  bubble: {
    backgroundColor: 'rgba(240, 240, 245, 1)',
    borderRadius: 20,
    padding: 12,
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    maxHeight: 120,
    minHeight: 40,
    paddingVertical: 4,
    paddingRight: 80,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    padding: 4,
  },
  sendButton: {
    padding: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default WritingBubble;