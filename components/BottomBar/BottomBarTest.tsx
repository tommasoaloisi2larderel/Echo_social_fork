import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomBar from './index';

// Composant de test pour la nouvelle version de la BottomBar
const BottomBarTest: React.FC = () => {
  const [useV2, setUseV2] = React.useState(false);
  const [chatText, setChatText] = React.useState('');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Test BottomBar</Text>
        <TouchableOpacity
          style={[styles.toggleButton, useV2 && styles.toggleButtonActive]}
          onPress={() => setUseV2(!useV2)}
        >
          <Text style={[styles.toggleText, useV2 && styles.toggleTextActive]}>
            {useV2 ? 'Version V2' : 'Version V1'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description}>
          {useV2 
            ? 'Version V2 : Bouton Jarvis initial → Barre de chat → Panneau agents' 
            : 'Version V1 : Barre de chat classique avec panneau agents'
          }
        </Text>
      </View>

      <BottomBar
        currentRoute="test"
        chatText={chatText}
        setChatText={setChatText}
        conversationId="test"
        useV2={useV2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default BottomBarTest;
