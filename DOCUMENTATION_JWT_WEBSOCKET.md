# 🔐 Documentation - Gestion JWT et WebSocket

## 📋 Vue d'ensemble

Ce document explique les améliorations apportées à la gestion des tokens JWT et des connexions WebSocket pour garantir que les tokens sont toujours valides et que les WebSockets se reconnectent automatiquement lors du rafraîchissement des tokens.

## 🎯 Problèmes résolus

### Avant les changements :
1. ❌ Les WebSockets utilisaient le token initial et ne se mettaient pas à jour quand le token était rafraîchi
2. ❌ Pas de vérification de la validité du token avant d'ouvrir une connexion WebSocket
3. ❌ Si un token expirait pendant une connexion WebSocket active, la connexion devenait invalide
4. ❌ Pas de système pour notifier les composants quand un token était rafraîchi

### Après les changements :
1. ✅ Les WebSockets se reconnectent automatiquement avec le nouveau token
2. ✅ Vérification systématique du token avant toute connexion WebSocket
3. ✅ Rafraîchissement proactif des tokens avant expiration
4. ✅ Système d'événements pour notifier tous les composants

---

## 🏗️ Architecture

### 1. **AuthContext** (`contexts/AuthContext.tsx`)

#### Nouvelles méthodes ajoutées :

```typescript
interface AuthContextType {
  // ... méthodes existantes ...

  /**
   * Garantit qu'on a un token valide
   * Rafraîchit automatiquement si le token expire bientôt
   */
  ensureValidToken: () => Promise<string | null>;

  /**
   * S'abonner aux événements de rafraîchissement de token
   * Retourne une fonction pour se désabonner
   */
  onTokenRefresh: (callback: (newAccessToken: string) => void) => () => void;

  /**
   * Vérifie si le token expire bientôt
   */
  isTokenExpiringSoon: (bufferMinutes?: number) => boolean;
}
```

#### Fonctionnement :

1. **Auto-refresh** : Toutes les 4 minutes, vérifie si le token expire dans moins de 5 minutes
2. **Event system** : Notifie tous les listeners quand un token est rafraîchi
3. **ensureValidToken()** :
   - Vérifie si le token actuel est valide
   - Si le token expire dans moins de 5 minutes → rafraîchit automatiquement
   - Retourne toujours un token valide ou null

---

### 2. **useWebSocketWithAuth Hook** (`hooks/useWebSocketWithAuth.ts`)

Hook personnalisé pour gérer les connexions WebSocket avec gestion automatique des tokens.

#### Utilisation :

```typescript
const {
  websocket,      // Instance WebSocket
  send,           // Fonction pour envoyer des messages
  isConnected,    // État de connexion
  connect,        // Connecter manuellement
  disconnect,     // Déconnecter manuellement
} = useWebSocketWithAuth({
  url: 'wss://example.com/ws/chat/',
  onMessage: (event) => {
    // Gérer les messages
  },
  onOpen: () => {
    // Connexion établie
  },
  onClose: () => {
    // Connexion fermée
  },
  onError: (error) => {
    // Erreur
  },
  autoConnect: false, // Connexion manuelle
});
```

#### Fonctionnalités :

1. **✅ Vérification du token** :
   - Appelle `ensureValidToken()` avant chaque connexion
   - Garantit que le WebSocket utilise toujours un token valide

2. **✅ Reconnexion automatique** :
   - S'abonne aux événements de rafraîchissement de token
   - Reconnecte automatiquement le WebSocket avec le nouveau token
   - Gère les reconnexions avec backoff exponentiel en cas d'erreur

3. **✅ Vérification périodique** :
   - Vérifie toutes les 5 minutes si le token expire bientôt
   - Rafraîchit proactivement le token pour éviter les déconnexions

---

### 3. **Mise à jour des écrans de conversation**

#### Fichiers modifiés :
- `app/(tabs)/conversation-direct.tsx`
- `app/(tabs)/conversation-group.tsx`

#### Changements :

**Avant :**
```typescript
const [localWebsocket, setLocalWebsocket] = useState<WebSocket | null>(null);

const connectWebSocket = () => {
  const ws = new WebSocket(url, ["access_token", accessToken]);
  ws.onopen = () => {
    setLocalWebsocket(ws);
    // ...
  };
  // ...
};

useEffect(() => {
  connectWebSocket();
  return () => {
    if (localWebsocket) localWebsocket.close();
  };
}, [conversationId, accessToken]);
```

**Après :**
```typescript
const {
  websocket: localWebsocket,
  send: wsSend,
  isConnected: wsIsConnected,
  connect: wsConnect,
  disconnect: wsDisconnect
} = useWebSocketWithAuth({
  url: "wss://reseausocial-production.up.railway.app/ws/chat/",
  autoConnect: false,
  onOpen: () => {
    console.log('✅ WebSocket connected');
    setWebsocket(localWebsocket);
    setCurrentConversationId(conversationId as string);

    if (conversationId) {
      wsSend(JSON.stringify({
        type: "mark_as_seen",
        conversation_uuid: conversationId
      }));
    }
  },
  onMessage: (event) => {
    // Gestion des messages...
  },
  onError: (error) => {
    console.error("❌ WebSocket error:", error);
  },
  onClose: () => {
    console.log('🔌 WebSocket closed');
    setWebsocket(null);
    setCurrentConversationId(null);
  },
});

useEffect(() => {
  if (conversationId && accessToken) {
    fetchMessages();
    wsConnect(); // ✅ Connexion avec token validé
  }

  return () => {
    wsDisconnect(); // ✅ Nettoyage propre
  };
}, [conversationId, accessToken]);
```

---

## 🔄 Flux de fonctionnement

### Scénario 1 : Ouverture d'une conversation

1. L'utilisateur ouvre une conversation
2. Le composant appelle `wsConnect()`
3. Le hook appelle `ensureValidToken()`
   - Si le token expire dans < 5 min → rafraîchit le token
   - Sinon → utilise le token actuel
4. Crée le WebSocket avec le token valide
5. Connexion établie ✅

### Scénario 2 : Token rafraîchi pendant une conversation active

1. L'auto-refresh détecte que le token expire dans 4 minutes
2. Appelle `/api/auth/token/refresh/`
3. Récupère un nouveau access token
4. **Notifie tous les listeners** avec le nouveau token
5. Le hook `useWebSocketWithAuth` reçoit la notification
6. **Reconnecte automatiquement** le WebSocket avec le nouveau token
7. L'utilisateur ne remarque rien, la conversation continue ✅

### Scénario 3 : Vérification périodique pendant une connexion

1. Toutes les 5 minutes, le hook vérifie : `isTokenExpiringSoon(10)`
2. Si le token expire dans < 10 minutes :
   - Appelle `ensureValidToken()`
   - Rafraîchit proactivement le token
3. Le WebSocket reste connecté sans interruption ✅

---

## 📊 Configuration des tokens

D'après votre documentation backend :

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),   # 1 heure
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),      # 7 jours
    'ROTATE_REFRESH_TOKENS': True,                    # Rotation activée
    'BLACKLIST_AFTER_ROTATION': True,                 # Blacklist activée
}
```

### Timings du frontend :

- **Auto-refresh check** : Toutes les 4 minutes
- **Buffer de rafraîchissement** : 5 minutes avant expiration
- **Vérification WebSocket** : Toutes les 5 minutes pendant la connexion
- **Reconnexion** : Immédiate lors du rafraîchissement du token

---

## 🎯 Endpoints utilisés

### 1. Login
```
POST /api/auth/login/
Body: { username, password }
Response: { access, refresh, user }
```

### 2. Rafraîchir le token
```
POST /api/auth/token/refresh/
Body: { refresh }
Response: { access, refresh }  // ⚠️ Nouveau refresh token si rotation activée
```

### 3. Vérifier un token (optionnel)
```
POST /api/auth/token/verify/
Body: { token }
Response: 200 OK (valide) | 401 Unauthorized (invalide)
```

### 4. Logout
```
POST /api/auth/logout/
Headers: Authorization: Bearer <access_token>
Body: { refresh }
Response: { success }
```

---

## ✅ Avantages de cette implémentation

1. **🔐 Sécurité renforcée** :
   - Les tokens sont toujours vérifiés avant utilisation
   - Rafraîchissement automatique avant expiration
   - Pas de requêtes avec des tokens expirés

2. **🚀 Meilleure UX** :
   - Les WebSockets ne se déconnectent jamais à cause d'un token expiré
   - Reconnexion transparente invisible pour l'utilisateur
   - Pas d'interruption de service

3. **🧹 Code propre** :
   - Logique de gestion des tokens centralisée dans `AuthContext`
   - Hook réutilisable pour tous les WebSockets
   - Moins de code dupliqué dans les composants

4. **🐛 Moins de bugs** :
   - Gestion cohérente des tokens dans toute l'application
   - Moins de cas limites à gérer manuellement
   - Comportement prévisible

---

## 🔧 Utilisation dans d'autres composants

Si vous avez d'autres WebSockets dans votre application, utilisez simplement le hook :

```typescript
import { useWebSocketWithAuth } from '@/hooks/useWebSocketWithAuth';

function MyComponent() {
  const { send, isConnected } = useWebSocketWithAuth({
    url: 'wss://your-websocket-url',
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      // Traiter le message
    },
  });

  const handleSendMessage = () => {
    if (isConnected) {
      send(JSON.stringify({ type: 'message', content: 'Hello!' }));
    }
  };

  return (
    <div>
      <button onClick={handleSendMessage} disabled={!isConnected}>
        Envoyer
      </button>
    </div>
  );
}
```

---

## 📝 Notes importantes

1. **Rotation des refresh tokens** :
   - Votre backend retourne un nouveau refresh token à chaque rafraîchissement
   - L'ancien refresh token est blacklisté
   - Le frontend stocke automatiquement le nouveau refresh token

2. **Gestion des erreurs** :
   - Si le rafraîchissement échoue → logout automatique
   - Si le WebSocket ne peut pas se connecter → reconnexions avec backoff exponentiel (max 5 tentatives)

3. **Performances** :
   - Les vérifications périodiques sont optimisées pour minimiser l'impact
   - Les reconnexions WebSocket sont rapides et transparentes

---

## 🎉 Résultat final

Votre application dispose maintenant d'un système robuste de gestion des tokens JWT qui :
- ✅ Vérifie la validité des tokens avant chaque opération critique
- ✅ Rafraîchit automatiquement les tokens avant expiration
- ✅ Reconnecte les WebSockets avec les nouveaux tokens
- ✅ Offre une expérience utilisateur fluide sans interruption

Les utilisateurs peuvent maintenant utiliser l'application en continu sans jamais être déconnectés à cause d'un token expiré, même pendant des conversations WebSocket actives ! 🚀
