import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface JarvisInteractionButtonProps {
  onActivate: () => void;
}

const JarvisInteractionButton: React.FC<JarvisInteractionButtonProps> = ({
  onActivate,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onActivate}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          {Platform.OS === 'ios' ? (
            <SymbolView 
              name="wave.3.right" 
              size={24} 
              tintColor="rgb(255, 255, 255)" 
              type="hierarchical" 
            />
          ) : (
            <Ionicons 
              name="mic" 
              size={24} 
              color="rgb(255, 255, 255)" 
            />
          )}
        </View>
        <Text style={styles.text}>Commande vocale</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.15)", // Background semi-transparent pour la visibilité
    borderRadius: 35,
    marginHorizontal: 0,
    marginBottom: 0, // Plus proche du bas
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0, // Le padding est déjà géré par le container
    paddingVertical: 8, // Padding vertical encore plus réduit pour une barre plus fine
  },
  iconContainer: {
    marginRight: 12,
  },
  text: {
    color: "#fff",
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  signalIcon: {
    marginLeft: 12,
  },
});

export default JarvisInteractionButton;
