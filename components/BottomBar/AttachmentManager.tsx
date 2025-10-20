import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from "expo-symbols";
import {
    ActionSheetIOS,
    Alert,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { StagedAttachment } from "./types";

interface AttachmentManagerProps {
  stagedAttachments: StagedAttachment[];
  setStagedAttachments: React.Dispatch<React.SetStateAction<StagedAttachment[]>>;
  onSendAttachments: (attachmentUuids: string[], caption?: string) => Promise<void>;
  uploadAttachment: (file: { uri: string; name: string; type: string }) => Promise<string | null>;
  chatText: string;
  setChatText: (text: string) => void;
}

export default function AttachmentManager({
  stagedAttachments,
  setStagedAttachments,
  onSendAttachments,
  uploadAttachment,
  chatText,
  setChatText,
}: AttachmentManagerProps) {

  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photos', 'Autorisez l\'accès aux photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      setStagedAttachments((prev) => [...prev, { uri: asset.uri, name, type: 'image/jpeg', kind: 'image' }]);
    } catch (e) {
      console.error('pick photo error', e);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: '*/*',
        copyToCacheDirectory: true
      });
      // @ts-ignore
      if (res.canceled || res.type === 'cancel') return;
      // @ts-ignore
      const file = res.assets?.[0] || res;
      const uri = file.uri;
      const name = file.name || `file_${Date.now()}`;
      const mime = file.mimeType || 'application/octet-stream';
      setStagedAttachments((prev) => [...prev, { uri, name, type: mime, kind: 'file' }]);
    } catch (e) {
      console.error('pick doc error', e);
    }
  };

  const handlePlus = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Photo', 'Fichier'],
          cancelButtonIndex: 0
        },
        (idx) => {
          if (idx === 1) handlePickPhoto();
          else if (idx === 2) handlePickDocument();
        }
      );
    } else {
      Alert.alert('Ajouter', 'Choisissez une option', [
        { text: 'Photo', onPress: handlePickPhoto },
        { text: 'Fichier', onPress: handlePickDocument },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const removeStagedAt = (index: number) => {
    setStagedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendAttachments = async () => {
    if (stagedAttachments.length === 0) return;
    
    try {
      const uuids: string[] = [];
      for (const att of stagedAttachments) {
        const u = await uploadAttachment({ uri: att.uri, name: att.name, type: att.type });
        if (u) uuids.push(u);
      }
      if (uuids.length > 0) {
        await onSendAttachments(uuids, chatText.trim());
        setChatText("");
        setStagedAttachments([]);
      }
    } catch (e) {
      console.error('send attachments error', e);
    }
  };

  return {
    handlePlus,
    handleSendAttachments,
    removeStagedAt,
    StagedAttachmentsDisplay: () => (
      stagedAttachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 56, marginRight: 8 }}
        >
          {stagedAttachments.map((att, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(10,145,104,0.08)',
                borderRadius: 12,
                paddingVertical: 6,
                paddingHorizontal: 8,
                marginRight: 6
              }}
            >
              {att.kind === 'image' ? (
                <Ionicons name="image" size={16} color="rgba(10,145,104,1)" />
              ) : (
                <Ionicons name="document" size={16} color="rgba(10,145,104,1)" />
              )}
              <Text numberOfLines={1} style={{ maxWidth: 120, marginLeft: 6, color: '#1a1a1a' }}>
                {att.name}
              </Text>
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
      ) : null
    )
  };
}