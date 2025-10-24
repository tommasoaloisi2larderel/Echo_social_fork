import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ChatInputBarProps {
  chatText: string;
  onChangeText: (text: string) => void;
  onSendMessage: () => void;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  chatText,
  onChangeText,
  onSendMessage,
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        value={chatText}
        onChangeText={onChangeText}
        placeholder="Message..."
        placeholderTextColor="#888"
        multiline
        maxLength={5000}
      />
      <TouchableOpacity
        style={[styles.sendButton, !chatText.trim() && styles.sendButtonDisabled]}
        onPress={onSendMessage}
        disabled={!chatText.trim()}
        activeOpacity={0.8}
      >
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="arrow.up.circle.fill" 
            size={20} 
            tintColor={chatText.trim() ? "rgba(10, 145, 104, 1)" : "#ccc"} 
            type="hierarchical" 
          />
        ) : (
          <Ionicons 
            name="send" 
            size={22} 
            color={chatText.trim() ? "rgba(10, 145, 104, 1)" : "#ccc"} 
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(10, 145, 104, 0.2)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#444",
    fontWeight: "400",
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 4,
    paddingRight: 8,
    textAlignVertical: 'center',
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(200, 200, 200, 0.1)',
  },
});

export default ChatInputBar;

