import React, { useEffect, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

interface ComposingMessageBubbleProps {
  chatText: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
}

const ComposingMessageBubble: React.FC<ComposingMessageBubbleProps> = ({
  chatText,
  onChangeText,
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
      style={styles.container}
    >
      <View style={styles.bubbleWrapper}>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Above the bottom bar
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bubbleWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bubble: {
    backgroundColor: 'rgba(255, 237, 213, 1)', // Light orange/peach color for differentiation
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
    maxHeight: 150,
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderWidth: 2,
    borderColor: 'rgba(10, 145, 104, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    minHeight: 24,
  },
});

export default ComposingMessageBubble;