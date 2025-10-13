import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import { BlurView } from "expo-blur";
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
    ActionSheetIOS,
    Alert,
    Animated,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useNavigation } from "../contexts/NavigationContext";
import { styles } from "../styles/appStyles";

interface BottomBarProps {
  currentRoute: string;
  chatText: string;
  setChatText: (text: string) => void;
  chatRecipient?: string;
  onSendMessage?: () => void;
  conversationId?: string;
}

export default function BottomBar({ 
  currentRoute, 
  chatText, 
  setChatText, 
  chatRecipient = "",
  onSendMessage,
  conversationId
}: BottomBarProps) {
  
  const isChat = currentRoute.includes("conversation-direct") || currentRoute.includes("conversation-group") || currentRoute.includes("conversation-detail");
  const { accessToken, makeAuthenticatedRequest } = useAuth();
  const { navigateToScreen } = useNavigation();
  const { sendMessage: sendChatMessage, websocket } = useChat();
  
  // Dimensions de l'écran
  const screenHeight = Dimensions.get('window').height;
  // hauteur de l'espace panneau (90% de l'écran)
  const MAX_TRANSLATE = screenHeight * 0.75; // hauteur du panneau

  // translateY du panneau: 0 = ouvert, MAX_TRANSLATE = fermé (caché sous la barre)
  const sheetY = useRef(new Animated.Value(MAX_TRANSLATE)).current;
  const isPanelOpen = useRef(false);
  const dragStartY = useRef(0);

  const [barHeight, setBarHeight] = useState(96); // default, will be measured
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  
  // Animations pour l'effet WOW
  const particleAnim1 = useRef(new Animated.Value(0)).current;
  const particleAnim2 = useRef(new Animated.Value(0)).current;
  const particleAnim3 = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Gestion du clavier - monte la bottomBar au-dessus
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Animation des particules en boucle
  useEffect(() => {
    const particle1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim1, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    
    const particle2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim2, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim2, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    );
    
    const particle3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim3, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim3, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    particle1Loop.start();
    particle2Loop.start();
    particle3Loop.start();
    glowLoop.start();

    return () => {
      particle1Loop.stop();
      particle2Loop.stop();
      particle3Loop.stop();
      glowLoop.stop();
    };
  }, []);
  
  // Debug: vérifier que isChat fonctionne
  console.log("BottomBar - currentRoute:", currentRoute, "isChat:", isChat);
  
  // PanResponder pour gérer le swipe - capture les gestes sur toute la barre
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: (_, g) => {
        // Capturer uniquement les mouvements verticaux significatifs
        return Math.abs(g.dy) > 3;
      },
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        // Capturer les swipes verticaux avant les enfants (TextInput, boutons)
        return Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx);
      },
      onPanResponderGrant: () => {
        // @ts-ignore
        dragStartY.current = (sheetY as any)._value ?? MAX_TRANSLATE;
      },
      onPanResponderMove: (_, g) => {
        const next = dragStartY.current + g.dy; // dy>0 vers le bas
        const clamped = Math.max(0, Math.min(MAX_TRANSLATE, next));
        sheetY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        // @ts-ignore
        const current = (sheetY as any)._value ?? MAX_TRANSLATE;
        const shouldOpen = current < MAX_TRANSLATE / 2 || g.vy < -0.5;
        if (shouldOpen) openPanel(); else closePanel();
      },
    })
  ).current;

  // Fonctions pour ouvrir/fermer le panneau avec effet WOW
  const openPanel = () => {
    isPanelOpen.current = true;
    Animated.parallel([
      Animated.spring(sheetY, { 
        toValue: 0, 
        useNativeDriver: true, 
        tension: 50, 
        friction: 8 
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
    ]).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    });
  };
  
  const closePanel = () => {
    isPanelOpen.current = false;
    Animated.parallel([
      Animated.spring(sheetY, { 
        toValue: MAX_TRANSLATE, 
        useNativeDriver: true, 
        tension: 60, 
        friction: 10 
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
    ]).start();
  };

  // Fonction pour envoyer un message
  const handleSendMessage = async () => {
    if (!chatText.trim()) {
      console.log("⚠️ Message vide, pas d'envoi");
      return;
    }

    try {
      if (isChat && sendChatMessage) {
        // Envoi de message dans une conversation existante via WebSocket
        console.log("📤 Envoi message via WebSocket:", chatText);
        sendChatMessage(chatText);
        
        // Vider le champ après envoi
        setChatText("");
      } else if (!isChat) {
        // Envoi de message à l'IA Jarvis
        console.log("🤖 Envoi message à Jarvis:", chatText);
        const response = await makeAuthenticatedRequest(
          'https://reseausocial-production.up.railway.app/ai/chat/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: chatText.trim(),
            }),
          }
        );
        
        if (response.ok) {
          console.log("✅ Message envoyé à Jarvis avec succès");
          setChatText("");
        } else {
          console.error("❌ Erreur envoi message à Jarvis:", response.status);
        }
      } else {
        console.warn("⚠️ Pas de fonction d'envoi disponible");
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi du message:", error);
    }
  };

  // --------- Pièces jointes & Upload ---------
  // Utilise le proxy local pour éviter CORS en développement web
  const API_BASE_URL = typeof window !== 'undefined' && (window as any).location?.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";

  const uploadAttachment = async (file: { uri: string; name: string; type: string }): Promise<string | null> => {
    try {
      const form = new FormData();
      // @ts-ignore - React Native FormData accepte { uri, name, type }
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
      const resp = await fetch(`${API_BASE_URL}/messaging/attachments/upload/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          // ne pas mettre Content-Type: RN le gère pour FormData
        },
        body: form,
      });
      if (!resp.ok) {
        console.error('❌ Upload attachment failed', resp.status);
        return null;
      }
      const data = await resp.json();
      return data?.uuid || null;
    } catch (e) {
      console.error('❌ Upload attachment error', e);
      return null;
    }
  };

  const sendAttachmentMessage = async (attachmentUuids: string[], caption?: string) => {
    if (!conversationId) return;
    const payload: any = {
      type: 'chat_message',
      conversation_uuid: conversationId,
      message: (caption || '').trim(),
      attachment_uuids: attachmentUuids,
    };
    try {
      if (websocket) {
        websocket.send(JSON.stringify(payload));
      } else {
        // Fallback REST si websocket indisponible
        const resp = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages/create-with-attachments/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: payload.message, attachment_uuids: attachmentUuids }),
        });
        if (!resp.ok) console.error('❌ Fallback REST envoi PJ échoué', resp.status);
      }
    } catch (e) {
      console.error('❌ Envoi PJ error', e);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permission requise', 'Autorisez l’accès à la galerie.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const name = a.fileName || `photo_${Date.now()}.jpg`;
      const type = a.mimeType || 'image/jpeg';
      const uri = a.uri;
      // Stage l'attachement dans la barre, l'envoi se fait au "send"
      setStagedAttachments((prev) => [...prev, { uri, name, type, kind: 'image' as const }]);
    } catch (e) { console.error('pick photo error', e); }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const name = a.name || `fichier_${Date.now()}`;
      const type = a.mimeType || 'application/octet-stream';
      const uri = a.uri;
      setStagedAttachments((prev) => [...prev, { uri, name, type, kind: 'file' as const }]);
    } catch (e) { console.error('pick doc error', e); }
  };

  const handlePlus = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        options: ['Annuler', 'Photo', 'Fichier'],
        cancelButtonIndex: 0,
      }, (idx) => {
        if (idx === 1) handlePickPhoto();
        else if (idx === 2) handlePickDocument();
      });
    } else {
      Alert.alert('Ajouter', 'Choisissez une option', [
        { text: 'Photo', onPress: handlePickPhoto },
        { text: 'Fichier', onPress: handlePickDocument },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  // --------- Message vocal ---------
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Micro', 'Autorisez le micro pour enregistrer.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (e) {
      console.error('startRecording error', e);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      if (uri) setRecordedUri(uri);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } catch (e) {
      console.error('stopRecording error', e);
    }
  };

  const cancelRecorded = () => {
    setRecordedUri(null);
    setRecordingSeconds(0);
  };

  const sendRecorded = async () => {
    if (!recordedUri) return;
    const uuid = await uploadAttachment({ uri: recordedUri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' });
    if (uuid) await sendAttachmentMessage([uuid]);
    setRecordedUri(null);
    setRecordingSeconds(0);
  };

  // --------- Staging visuel des PJ ---------
  type StagedAttachment = { uri: string; name: string; type: string; kind: 'image' | 'file' };
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const removeStagedAt = (index: number) => {
    setStagedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (recordedUri) { await sendRecorded(); return; }
    if (stagedAttachments.length > 0) {
      try {
        const uuids: string[] = [];
        for (const att of stagedAttachments) {
          const u = await uploadAttachment({ uri: att.uri, name: att.name, type: att.type });
          if (u) uuids.push(u);
        }
        if (uuids.length > 0) {
          await sendAttachmentMessage(uuids, chatText.trim());
          setChatText("");
          setStagedAttachments([]);
        }
      } catch (e) { console.error('send attachments error', e); }
      return;
    }
    await handleSendMessage();
  };

  // Calcul de l'opacité et autres interpolations
  const blurOpacity = sheetY.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const overlayOpacity = sheetY.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [0.6, 0],
    extrapolate: 'clamp',
  });

  const blurIntensity = sheetY.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [20, 0],
    extrapolate: 'clamp',
  });

  // Animations des particules
  const particle1Y = particleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const particle2Y = particleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -150],
  });

  const particle3Y = particleAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const particle1Opacity = particleAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const particle2Opacity = particleAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 0],
  });

  const particle3Opacity = particleAnim3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.9, 0],
  });

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <>
      {/* Overlay sombre avec blur - couvre tout l'écran */}
      <Animated.View
        pointerEvents={isPanelOpen.current ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: overlayOpacity,
          zIndex: 9998,
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closePanel}
          style={{ flex: 1 }}
        >
          <BlurView
            intensity={Platform.OS === 'web' ? 0 : 15}
            tint="dark"
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999,
          transform: [{ translateY: keyboardOffset }],
        }}
      >
        {/* Particules lumineuses mystérieuses - seulement visibles quand le panneau est ouvert */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '20%',
            bottom: 150,
            opacity: Animated.multiply(blurOpacity, particle1Opacity),
            transform: [{ translateY: particle1Y }],
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: 'rgba(10, 145, 104, 0.4)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.8,
              shadowRadius: 20,
              elevation: 10,
            }}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: '15%',
            bottom: 180,
            opacity: Animated.multiply(blurOpacity, particle2Opacity),
            transform: [{ translateY: particle2Y }],
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(10, 145, 104, 0.5)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.9,
              shadowRadius: 15,
              elevation: 10,
            }}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '60%',
            bottom: 200,
            opacity: Animated.multiply(blurOpacity, particle3Opacity),
            transform: [{ translateY: particle3Y }],
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(10, 145, 104, 0.35)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.7,
              shadowRadius: 18,
              elevation: 10,
            }}
          />
        </Animated.View>

        {/* Effet de lueur pulsante derrière le panneau */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 250,
            opacity: blurOpacity,
            zIndex: 500,
          }}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }}
          >
            <LinearGradient
              colors={[
                'rgba(10, 145, 104, 0)',
                'rgba(10, 145, 104, 0.1)',
                'rgba(10, 145, 104, 0.3)',
                'rgba(10, 145, 104, 0.5)',
              ]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </Animated.View>
        </Animated.View>

        {/* Gradient principal mystérieux */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 200,
            opacity: blurOpacity,
            zIndex: 1000,
          }}
        >
          <LinearGradient
            colors={[
              'rgba(10, 145, 104, 0)',
              'rgba(10, 145, 104, 0.0)',
              'rgba(10, 145, 104, 0.2)',
              'rgba(10, 145, 104, 0.4)',
            ]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>

        {/* Panneau coulissant pour la gestion des agents IA - avec effet de profondeur */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: MAX_TRANSLATE,
            backgroundColor: 'white',
            shadowColor: 'rgba(10, 145, 104, 0.6)',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 15,
            transform: [
              { translateY: sheetY },
              { scale: scaleAnim },
            ],
          }}
        >
          {/* Bordure lumineuse en haut du panneau - effet dimension parallèle */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              opacity: blurOpacity,
              zIndex: 1,
            }}
          >
            <LinearGradient
              colors={[
                'rgba(10, 145, 104, 1)',
                'rgba(10, 145, 104, 0.6)',
                'rgba(10, 145, 104, 1)',
              ]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Gradient de fond subtil pour donner de la profondeur */}
          <LinearGradient
            colors={[
              'rgba(240, 250, 248, 0.95)',
              'rgba(255, 255, 255, 1)',
            ]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {/* BottomBar - toujours visible en haut du conteneur (fait aussi office de header) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View 
            style={styles.bottomBar} 
            onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
            {...panResponder.panHandlers}
          >
        {/* Indicateur de swipe - animé */}
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
        
        {/* Barre de chat: enregistrement vocal ou saisie classique */}
        <View style={styles.chatSection}>
          {isRecording ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 12 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mic" size={18} color="#ef4444" />
                <Text style={{ marginLeft: 8, color: '#ef4444', fontWeight: '700' }}>Enregistrement...</Text>
                <Text style={{ marginLeft: 8, color: '#ef4444' }}>{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</Text>
              </View>
              <TouchableOpacity onPress={stopRecording}>
                {Platform.OS === 'ios' ? (
                  <SymbolView name="stop.circle.fill" size={24} tintColor="#ef4444" type="hierarchical" />
                ) : (
                  <Ionicons name="stop-circle" size={22} color="#ef4444" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {stagedAttachments.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56, marginRight: 8 }}>
                  {stagedAttachments.map((att, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,145,104,0.08)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8, marginRight: 6 }}>
                      {att.kind === 'image' ? (
                        <Ionicons name="image" size={16} color="rgba(10,145,104,1)" />
                      ) : (
                        <Ionicons name="document" size={16} color="rgba(10,145,104,1)" />
                      )}
                      <Text numberOfLines={1} style={{ maxWidth: 120, marginLeft: 6, color: '#1a1a1a' }}>{att.name}</Text>
                      <TouchableOpacity onPress={() => removeStagedAt(idx)} style={{ marginLeft: 6 }}>
                        {Platform.OS === 'ios' ? (
                          <SymbolView name="xmark.circle.fill" size={18} tintColor="#ff6b6b" type="hierarchical" />
                        ) : (
                          <Ionicons name="close-circle" size={18} color="#ff6b6b" />
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              {recordedUri ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
                  <Ionicons name="mic" size={18} color="#4ade80" />
                  <Text style={{ marginLeft: 8, color: '#4ade80', fontWeight: '700' }}>Vocal prêt</Text>
                  <TouchableOpacity style={{ marginLeft: 10 }} onPress={cancelRecorded}>
                    {Platform.OS === 'ios' ? (
                      <SymbolView name="xmark.circle.fill" size={20} tintColor="#ff6b6b" type="hierarchical" />
                    ) : (
                      <Ionicons name="close-circle" size={18} color="#ff6b6b" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={[styles.chatInput, { flex: 1, marginRight: 8 }]} 
                  placeholder={
                    isChat 
                      ? (websocket ? `Message...` : "Connexion...") 
                      : "Ask Jarvis anything"
                  }
                  placeholderTextColor="rgba(105, 105, 105, 0.8)"
                  value={chatText}
                  onChangeText={setChatText}
                  onSubmitEditing={handleSendMessage}
                  editable={isChat ? !!websocket : true}
                />
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: (chatText.trim() || recordedUri || stagedAttachments.length>0) ? "rgba(10, 145, 104, 0.)" : 'rgba(200, 200, 200, 0.)',
                  borderRadius: 25,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  opacity: (chatText.trim() || recordedUri || stagedAttachments.length>0) ? 1 : 0.6,
                }}
                onPress={handleSend}
                disabled={!chatText.trim() && !recordedUri && stagedAttachments.length===0}
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
        
        {/* Boutons conditionnels */}
        {isChat ? (
          <View style={styles.navBar}>
            {/* Bouton + (photo/fichier) */}
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

            {/* Retrait des boutons fichiers/photos (gérés par "+") */}

            {/* Bouton génération de message (placeholder) */}
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => Alert.alert('Génération', 'La génération de message sera implémentée plus tard.')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="sparkles"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="sparkles" size={22} color="rgba(240, 240, 240, 0.8)" />
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
            {/* Envoi/annulation du vocal via la barre principale (send/croix) */}
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

          {/* Contenu du panneau - Monde parallèle des agents IA */}
          <View style={{ flex: 1, padding: 20 }}>
            
            <View style={{ alignItems: 'center', marginBottom: 25, marginTop: 10 }}>
              <Animated.View
                style={{
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                }}
              >
                <Ionicons name="flash" size={40} color="rgba(10, 145, 104, 0.8)" />
              </Animated.View>
              <Text style={{ 
                fontSize: 22, 
                fontWeight: 'bold', 
                color: 'rgba(10, 145, 104, 1)', 
                marginTop: 10,
                textAlign: 'center',
              }}>
                Agents IA
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 5, textAlign: 'center' }}>
                Vos assistants intelligents
              </Text>
            </View>
            
            {/* Carte Agent Jarvis avec effet de profondeur */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={{ marginBottom: 15 }}
            >
              <LinearGradient
                colors={[
                  'rgba(10, 145, 104, 0.08)',
                  'rgba(10, 145, 104, 0.03)',
                ]}
                style={{
                  padding: 18,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(10, 145, 104, 0.2)',
                  shadowColor: 'rgba(10, 145, 104, 0.3)',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(10, 145, 104, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="flash" size={24} color="rgba(10, 145, 104, 1)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>
                      Agent Jarvis
                    </Text>
                    <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      Assistant personnel intelligent
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(10, 145, 104, 0.6)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Message mystérieux */}
            <Animated.View
              style={{
                opacity: glowOpacity,
                marginTop: 10,
              }}
            >
              <Text style={{ 
                fontSize: 13, 
                color: 'rgba(10, 145, 104, 0.7)', 
                textAlign: 'center',
                fontStyle: 'italic',
              }}>
                ✨ Swipez pour découvrir d'autres agents IA ✨
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
}