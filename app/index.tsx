import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  console.log('🏠 Index component loaded!');

  const { isLoggedIn, loading, user, accessToken } = useAuth();

  useEffect(() => {
    console.log('🏠 Index - État auth:', {
      loading,
      isLoggedIn,
      hasUser: !!user,
      hasToken: !!accessToken,
      username: user?.username
    });
    
    // Force redirection si authentifié
    if (!loading && isLoggedIn) {
      console.log('🚀 Force redirect to tabs');
      router.replace('/(tabs)');
    }
  }, [loading, isLoggedIn, user, accessToken]);

  // Pendant le chargement, afficher un spinner
  if (loading) {
    console.log('⏳ Index - Chargement...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#da913eff" />
        <Text style={{ marginTop: 10 }}>Chargement...</Text>
      </View>
    );
  }

  // Rediriger selon l'état de connexion
  if (isLoggedIn) {
    console.log('✅ Index - Redirection vers tabs via Redirect');
    return <Redirect href="/(tabs)" />;
  } else {
    console.log('❌ Index - Redirection vers login');
    return <Redirect href="/(auth)/login" />;
  }
}