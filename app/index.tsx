import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  console.log('🏠 Index component loaded!');

  const { user, accessToken } = useAuth();
  const isLoggedIn = !!(accessToken || user);

  console.log('🏠 Index - État auth:', {
    isLoggedIn,
    hasUser: !!user,
    hasToken: !!accessToken,
    username: user?.username
  });

  // Always allow access to main app (guest mode enabled)
  console.log('✅ Index - Redirection vers tabs (guest mode)');
  return <Redirect href="/(tabs)" />;
}