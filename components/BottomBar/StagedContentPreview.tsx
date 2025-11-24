import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AttachmentImage from '../FIlesLecture/AttachementImage';
import AudioPlayer from '../FIlesLecture/Audioplayer';

// Reuse the "Draft" style from ComposingMessageBubble
const DRAFT_BUBBLE_COLOR = 'rgba(255, 237, 213, 1)'; 
const DRAFT_BORDER_COLOR = 'rgba(10, 145, 104, 0.3)';

interface StagedContentPreviewProps {
  stagedFile?: { uri: string; type: 'image' | 'video' | 'file'; name: string } | null;
  stagedVoiceUri?: string | null;
  onCancel: () => void;
}

export default function StagedContentPreview({ 
  stagedFile, 
  stagedVoiceUri, 
  onCancel 
}: StagedContentPreviewProps) {
  
  if (!stagedFile && !stagedVoiceUri) return null;

  return (
    <View style={styles.container}>
      <View style={styles.bubbleWrapper}>
        <View style={styles.bubble}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>

          {stagedFile && stagedFile.type === 'image' && (
             // We pass the local URI as both thumbnail and full url for preview
            <AttachmentImage 
              thumbnailUrl={stagedFile.uri} 
              fullUrl={stagedFile.uri} 
              isMyMessage={true} // Uses the "User" alignment/style
            />
          )}

          {stagedFile && stagedFile.type === 'file' && (
            <View style={styles.fileContainer}>
                <Ionicons name="document-text" size={30} color="#444" />
                <Text style={styles.fileName} numberOfLines={1}>{stagedFile.name}</Text>
            </View>
          )}

          {stagedVoiceUri && (
            <AudioPlayer 
              audioUrl={stagedVoiceUri} 
              isMyMessage={true} 
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Just above the bar
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'flex-end', // Align to right like user messages
  },
  bubbleWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'flex-end',
  },
  cancelButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  bubble: {
    backgroundColor: DRAFT_BUBBLE_COLOR,
    borderRadius: 18,
    padding: 10,
    minHeight: 50,
    borderWidth: 2,
    borderColor: DRAFT_BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    // Ensure the bubble wraps content tightly but doesn't overflow
    maxWidth: '80%', 
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10
  },
  fileName: {
    fontSize: 16,
    color: '#333',
    maxWidth: 200
  }
});