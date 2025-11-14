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

    // Always redirect to tabs (guest mode enabled)
    console.log('🚀 Force redirect to tabs (guest mode enabled)');
    router.replace('/(tabs)');
  }, [isLoggedIn, user, accessToken]);

  // Always allow access to main app (guest mode)
  console.log('✅ Index - Redirection vers tabs (guest mode)');
  return <Redirect href="/(tabs)" />;
}