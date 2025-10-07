import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

type AuthMode = 'login' | 'register';
type ErrorType = 'none' | 'wrong_password' | 'user_not_found' | 'other';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>('none');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, register } = useAuth();
  const fadeAnim = useState(new Animated.Value(1))[0];

  const [showReset, setShowReset] = useState(false);
  const [resetTarget, setResetTarget] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const pulseAnim = useState(new Animated.Value(1))[0];
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const checkUsernameExists = async (usernameToCheck: string): Promise<boolean | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/exists/?username=${encodeURIComponent(usernameToCheck)}`);
      if (response.ok) {
        const data = await response.json();
        if (typeof data.exists === 'boolean') return data.exists;
      }
      return null; // unknown
    } catch (error) {
      console.error('Error checking username:', error);
      return null; // unknown
    }
  };

  const openReset = () => {
    setResetTarget(username.includes('@') ? username : '');
    setResetMessage('');
    setShowReset(true);
  };

  const handleSendReset = async () => {
    if (!resetTarget.trim()) {
      setResetMessage("Entrez votre email pour recevoir le lien de réinitialisation.");
      return;
    }
    try {
      setResetLoading(true);
      setResetMessage('');
      const res = await fetch(`${API_BASE_URL}/api/auth/password/reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetTarget.trim() }),
      });
      if (res.ok) {
        setResetMessage("Si un compte existe pour cet email, un lien vient d'être envoyé.");
      } else {
        setResetMessage("Impossible d'envoyer le lien pour le moment. Réessayez plus tard.");
      }
    } catch (e) {
      setResetMessage("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async () => {
    const u = username.trim();
    const p = password;
    const e = email.trim();

    // Basic form requirements
    if (!u || !p || (mode === 'register' && !e)) {
      setErrorType('other');
      setErrorMessage(!u || !p ? 'Veuillez remplir tous les champs' : "L'email est requis pour l'inscription");
      return;
    }

    setIsLoading(true);
    setErrorType('none');
    setErrorMessage('');

    try {
      if (mode === 'login') {
        // 1) If username not in DB -> switch to register
        const exists = await checkUsernameExists(u);
        if (exists === false) {
          setMode('register');
          setErrorType('user_not_found');
          setErrorMessage('Utilisateur non trouvé. Créons votre compte !');
          return;
        }

        // 2) Username exists (or unknown) -> try to login
        await login(u, p);
        router.replace('/(tabs)');
        return;
      }

      // 3) Register flow
      await register({ username: u, password: p, email: e });
      router.replace('/(tabs)');
    } catch (err) {
      // For login failures at this point, we assume wrong password
      if (mode === 'login') {
        setErrorType('wrong_password');
        setErrorMessage('Mot de passe incorrect');
      } else {
        setErrorType('other');
        setErrorMessage(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMode(mode === 'login' ? 'register' : 'login');
      setErrorType('none');
      setErrorMessage('');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#e8f5e9', '#c8e6c9', '#a5d6a7', '#81c784']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
          <View style={styles.bgBubble1} />
          <View style={styles.bgBubble2} />
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo/Header Section */}
          <View style={styles.headerSection}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="chatbubbles" size={60} color="white" />
            </Animated.View>
            <Text style={styles.appName}>Echo</Text>
            <Text style={styles.appTagline}>
              {mode === 'login' ? 'Bienvenue !' : 'Créez votre compte'}
            </Text>
          </View>

          {/* Form Section */}
          <LinearGradient style={styles.cardWrapper} colors={['rgba(46,125,50,0.35)', 'rgba(200,230,201,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}> 
              <Text style={styles.formTitle}>
                {mode === 'login' ? 'Connexion' : 'Inscription'}
              </Text>

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nom d'utilisateur"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setErrorType('none');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </View>

              {/* Email Input (Register only) */}
              {mode === 'register' && (
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholderTextColor="#999"
                  />
                </View>
              )}

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorType('none');
                  }}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#999" 
                  />
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {errorMessage && (
                <View style={[
                  styles.errorContainer,
                  errorType === 'user_not_found' && styles.infoContainer
                ]}>
                  <Ionicons 
                    name={errorType === 'user_not_found' ? 'information-circle' : 'alert-circle'} 
                    size={18} 
                    color={errorType === 'user_not_found' ? '#2e7d32' : '#ff6b6b'}
                  />
                  <Text style={[
                    styles.errorText,
                    errorType === 'user_not_found' && styles.infoText
                  ]}>
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Forgot Password (only on wrong password) */}
              {errorType === 'wrong_password' && (
                <TouchableOpacity style={styles.forgotPassword} onPress={openReset}>
                  <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              )}

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                  </>
                )}
              </TouchableOpacity>

              {/* Toggle Mode */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {mode === 'login' 
                    ? 'Pas encore de compte ?' 
                    : 'Déjà un compte ?'}
                </Text>
                <TouchableOpacity onPress={toggleMode}>
                  <Text style={styles.toggleButton}>
                    {mode === 'login' ? 'S\'inscrire' : 'Se connecter'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </LinearGradient>
        </ScrollView>
        <Modal visible={showReset} animationType="fade" transparent onRequestClose={() => setShowReset(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Réinitialiser le mot de passe</Text>
              <View style={styles.modalInputContainer}>
                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Votre email"
                  value={resetTarget}
                  onChangeText={setResetTarget}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#999"
                />
              </View>
              {!!resetMessage && <Text style={styles.modalSuccessText}>{resetMessage}</Text>}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={() => setShowReset(false)}>
                  <Text style={styles.modalButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleSendReset} disabled={resetLoading}>
                  {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Envoyer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  bgBubble1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(129, 199, 132, 0.35)',
    top: 60,
    left: -40,
    shadowColor: '#66bb6a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  bgBubble2: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(200, 230, 201, 0.35)',
    bottom: -40,
    right: -60,
    shadowColor: '#81c784',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  appTagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cardWrapper: {
    borderRadius: 28,
    padding: 2,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 26,
    padding: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 10,
    backdropFilter: 'blur(8px)',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f1f8e9',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  infoContainer: {
    backgroundColor: '#e8f5e9',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: '#ff6b6b',
    fontSize: 14,
  },
  infoText: {
    color: '#2e7d32',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
    marginRight: 5,
  },
  toggleButton: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f1f8e9',
    marginBottom: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginLeft: 8,
  },
  modalCancel: {
    backgroundColor: '#a5d6a7',
    marginLeft: 0,
    marginRight: 8,
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSuccessText: {
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 8,
  },
});