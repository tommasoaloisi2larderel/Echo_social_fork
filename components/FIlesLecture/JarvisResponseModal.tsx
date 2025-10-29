import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface JarvisResponseModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JarvisResponseModal: React.FC<JarvisResponseModalProps> = ({
  visible,
  onClose,
  title,
  message,
  icon = 'chatbubble-ellipses',
}) => {
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityValue,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: scaleValue }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Header avec gradient */}
              <LinearGradient
                colors={['rgba(10, 145, 104, 1)', 'rgba(8, 120, 85, 1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={icon} size={28} color="white" />
                </View>
                <Text style={styles.title}>{title}</Text>
              </LinearGradient>

              {/* Message */}
              <View style={styles.messageContainer}>
                <Text style={styles.message}>{message}</Text>
              </View>

              {/* Bouton OK */}
              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(10, 145, 104, 1)', 'rgba(8, 120, 85, 1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  messageContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    minHeight: 80,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  button: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default JarvisResponseModal;