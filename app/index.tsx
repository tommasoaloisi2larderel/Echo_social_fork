import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  console.log('🏠 Index component loaded!');

  const { user, accessToken } = useAuth();
  const isLoggedIn = !!(accessToken || user);

  useEffect(() => {
    console.log('🏠 Index - État auth:', {
      isLoggedIn,
      hasUser: !!user,
      hasToken: !!accessToken,
      username: user?.username
    });

    if (isLoggedIn) {
      console.log('🚀 Force redirect to tabs');
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, user, accessToken]);

  // Rediriger selon l'état de connexion
  if (isLoggedIn) {
    console.log('✅ Index - Redirection vers tabs via Redirect');
    return <Redirect href="/(tabs)" />;
  } else {
    console.log('❌ Index - Redirection vers login');
    return <Redirect href="/(auth)/login" />;
  }
}