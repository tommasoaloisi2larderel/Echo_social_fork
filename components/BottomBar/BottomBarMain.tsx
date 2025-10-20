import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { styles } from "../../styles/appStyles";

interface BottomBarMainProps {
  barHeight: number;
  setBarHeight: (height: number) => void;
  panResponderHandlers: any;
  glowOpacity: Animated.AnimatedInterpolation<number>;
  glowScale: Animated.AnimatedInterpolation<number>;
  isRecording: boolean;
  RecordingDisplay: React.ComponentType;
  recordedUri: string | null;
  StagedAttachmentsDisplay: React.ComponentType;
  chatText: string;
  setChatText: (text: string) => void;
  sendTarget: 'chat' | 'jarvis';
  websocket: any;
  handleSend: () => Promise<void>;
  isChat: boolean;
  handlePlus: () => void;
  setSendTarget: React.Dispatch<React.SetStateAction<'chat' | 'jarvis'>>;
  setJarvisActive: (active: boolean) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  navigateToScreen: (screen: string) => void;
  stagedAttachments: any[];
}

export default function BottomBarMain({
  barHeight,
  setBarHeight,
  panResponderHandlers,
  glowOpacity,
  glowScale,
  isRecording,
  RecordingDisplay,
  recordedUri,
  StagedAttachmentsDisplay,
  chatText,
  setChatText,
  sendTarget,
  websocket,
  handleSend,
  isChat,
  handlePlus,
  setSendTarget,
  setJarvisActive,
  startRecording,
  stopRecording,
  navigateToScreen,
  stagedAttachments,
}: BottomBarMainProps) {

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={styles.bottomBar}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
        {...panResponderHandlers}
      >
        {/* Swipe indicator */}
        <Animated.View style={{
          width: 44,
          height: 6,
          backgroundColor: 'rgba(10, 145, 104, 0.3)',
          borderRadius: 3,
          alignSelf: 'center',
          marginBottom: 5,
          opacity: glowOpacity,
          transform: [{ scaleX: glowScale }],
          shadowColor: 'rgba(10, 145, 104, 0.5)',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 3,
        }} />

        {/* Chat section */}
        <View style={styles.chatSection}>
          {isRecording ? (
            <RecordingDisplay />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <StagedAttachmentsDisplay />
              {recordedUri ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
                  <Ionicons name="mic" size={18} color="#4ade80" />
                  <Text style={{ marginLeft: 8, color: '#4ade80', fontWeight: '700' }}>Vocal prêt</Text>
                </View>
              ) : (
                <TextInput
                  style={[styles.chatInput, { flex: 1, marginRight: 8 }]}
                  placeholder={
                    sendTarget === 'jarvis'
                      ? 'Ask Jarvis anything'
                      : (websocket ? 'Message...' : 'Connexion...')
                  }
                  placeholderTextColor="rgba(105, 105, 105, 0.8)"
                  value={chatText}
                  onChangeText={setChatText}
                  onSubmitEditing={handleSend}
                  editable={sendTarget === 'chat' ? !!websocket : true}
                />
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: (chatText.trim() || recordedUri || stagedAttachments.length > 0) ? "rgba(10, 145, 104, 0.9)" : 'rgba(200, 200, 200, 0.5)',
                  borderRadius: 25,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  opacity: (chatText.trim() || recordedUri || stagedAttachments.length > 0) ? 1 : 0.6,
                }}
                onPress={handleSend}
                disabled={!chatText.trim() && !recordedUri && stagedAttachments.length === 0}
              >
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="arrow.up.circle.fill"
                    size={20}
                    tintColor="white"
                    type="hierarchical"
                  />
                ) : (
                  <Ionicons name="send" size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Navigation buttons */}
        {isChat ? (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePlus}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="plus.circle.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.9)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="add-circle" size={24} color="rgba(240, 240, 240, 0.9)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                setSendTarget((prev) => {
                  const next = prev === 'jarvis' ? 'chat' : 'jarvis';
                  if (next === 'chat') {
                    setJarvisActive(false);
                  } else {
                    setJarvisActive(true);
                  }
                  return next;
                });
              }}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name={sendTarget === 'jarvis' ? 'bubble.left.and.bubble.right.fill' : 'sparkles'}
                  size={24}
                  tintColor={sendTarget === 'jarvis' ? 'rgba(240, 240, 240, 0.9)' : 'rgba(255, 255, 255, 0.95)'}
                  type="hierarchical"
                />
              ) : (
                <Ionicons name={sendTarget === 'jarvis' ? 'chatbubbles' : 'sparkles'} size={22} color={sendTarget === 'jarvis' ? 'rgba(240, 240, 240, 0.9)' : 'rgba(255, 255, 255, 0.95)'} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onLongPress={startRecording}
              onPressOut={stopRecording}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="mic.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="mic" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateToScreen('conversations')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="bubble.left.and.bubble.right.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="chatbubbles" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateToScreen('home')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="house.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="home" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateToScreen('profile')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="person.circle.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="person-circle" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}