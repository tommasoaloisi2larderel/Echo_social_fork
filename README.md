# 📱 Frontend React Native - Réseau Social

> **Application mobile React Native/Expo connectée à un backend Django**  
> Backend URL: `https://reseausocial-production.up.railway.app`

---

## 🎯 Vue d'ensemble

Application de messagerie sociale avec agents IA, construite avec React Native/Expo et TypeScript. L'application utilise une architecture basée sur des **Contexts** pour la gestion d'état globale et **Expo Router** pour la navigation file-based.

### Technologies principales

- **React Native** avec **Expo SDK**
- **TypeScript** pour le typage statique
- **Expo Router** (navigation file-based)
- **WebSocket** pour le temps réel
- **SecureStore** pour le stockage sécurisé des tokens
- **Django REST + Channels** (backend)

---

## 📂 Structure des fichiers

### **Architecture globale**

```
/app
  ├── _layout.tsx           # Root layout avec tous les providers
  ├── index.tsx             # Point d'entrée (redirect vers auth/tabs)
  ├── (auth)/               # Écrans d'authentification
  │   ├── _layout.tsx
  │   ├── login.tsx
  │   └── register.tsx
  ├── (tabs)/               # Navigation principale (bottom tabs)
  │   ├── _layout.tsx       # Configuration tabs + SwipeableContainer + BottomBar
  │   ├── index.tsx         # 🏠 Home (résumés IA)
  │   ├── conversations.tsx # 💬 Liste conversations
  │   ├── about.tsx         # 👤 Profil
  │   ├── conversation-direct.tsx   # Messages 1-1
  │   └── conversation-group.tsx    # Messages de groupe
  └── (screens)/            # Écrans secondaires (modals/screens)
      ├── agents.tsx        # Marketplace agents IA
      ├── friends.tsx       # Gestion connexions/invitations
      ├── user-profile.tsx  # Profil d'un utilisateur
      ├── groups.tsx        # Gestion des groupes
      └── [...autres]

/components
  ├── BottomBar/            # Barre de navigation contextuelle
  │   ├── index.tsx         # Export principal
  │   ├── BottomBarV2.tsx   # Nouvelle version avec agents
  │   ├── AgentPanel.tsx    # Panneau sélection agents
  │   ├── JarvisChatBar.tsx # Interface Jarvis
  │   └── [...autres]
  ├── FIlesLecture/         # Composants de lecture fichiers
  │   ├── AttachementImage.tsx
  │   ├── AttachementVideo.tsx
  │   ├── Audioplayer.tsx
  │   └── JarvisResponseModal.tsx
  ├── JarvisInteraction/    # Composants interaction Jarvis
  ├── DefaultAvatar.tsx     # Avatar avec initiales
  ├── TypingIndicator.tsx   # Indicateur "en train d'écrire"
  └── SwipeableContainer.tsx # Container swipe pour navigation tabs

/contexts                   # 🔥 CONTEXTES GLOBAUX (état partagé)
  ├── AuthContext.tsx       # Authentification + tokens + user
  ├── ChatContext.tsx       # WebSocket + cache conversations/messages
  ├── UserProfileContext.tsx # Profil utilisateur courant
  ├── JarvisContext.tsx     # Historique Jarvis
  ├── AgentsContext.tsx     # Agents IA actifs
  ├── NavigationContext.tsx # Navigation programmatique
  └── TransitionContext.tsx # Animations de transition

/constants
  ├── colors.ts             # Palette de couleurs (ECHO_COLOR, BACKGROUND_GRAY)
  └── [...autres]

/styles
  └── appStyles.ts          # Styles réutilisables (containers, messages, cards)

/utils
  └── storage.ts            # Wrapper SecureStore (async storage)
```

---

## 🧩 Contextes (Providers)

> **Tous les contextes sont wrappés dans `app/_layout.tsx`** dans l'ordre suivant :

### 1. **AuthContext** 🔐

**Fichier:** `contexts/AuthContext.tsx`

**Responsabilités:**

- Gestion des tokens JWT (access + refresh)
- Méthodes `login()`, `register()`, `logout()`
- Rafraîchissement automatique des tokens expirés (intercepte 401)
- Stockage sécurisé avec `SecureStore`
- Fonction **`makeAuthenticatedRequest()`** → utilisée PARTOUT pour les appels API

**État exposé:**

```typescript
{
  user: User | null,
  accessToken: string | null,
  refreshToken: string | null,
  isLoggedIn: boolean,
  loading: boolean,
  login: (username, password) => Promise<void>,
  register: (data) => Promise<void>,
  logout: () => Promise<void>,
  makeAuthenticatedRequest: (url, options?) => Promise<Response>,
  updateUser: (user) => Promise<void>,
  reloadUser: () => Promise<void>
}
```

**API endpoints utilisés:**

- `POST /api/auth/login/`
- `POST /api/auth/register/`
- `POST /api/auth/logout/`
- `POST /api/auth/token/refresh/`
- `GET /api/auth/profile/`

---

### 2. **ChatContext** 💬

**Fichier:** `contexts/ChatContext.tsx`

**Responsabilités:**

- Gestion WebSocket (connexion, envoi messages)
- **Cache en mémoire** des conversations et messages
- Prefetch intelligent (avatars, conversations, messages)
- Gestion **SÉPARÉE** des conversations privées vs groupes

**État exposé:**

```typescript
{
  websocket: WebSocket | null,
  setWebsocket: (ws) => void,
  sendMessage: ((msg: string) => void) | null,
  currentConversationId: string | null,

  // Cache
  getCachedMessages: (conversationId) => Message[],
  getCachedConversationInfo: (conversationId) => any,
  primeCache: (conversationId, info, messages) => void,

  // Prefetch
  prefetchConversation: (id, request) => Promise<void>,
  prefetchAvatars: (urls[]) => Promise<void>,
  prefetchAllMessages: (request) => Promise<void>,
  prefetchConversationsOverview: (request) => Promise<void>,

  // Caches séparés privé/groupe
  getCachedPrivateConversations: () => Conversation[],
  setCachedPrivateConversations: (list) => void,
  getCachedGroupConversations: () => Conversation[],
  setCachedGroupConversations: (list) => void,
  getCachedConnections: () => User[],
  getCachedGroups: () => Group[],
  getCachedGroupInvitations: () => Invitation[]
}
```

**Endpoints API:**

- `GET /messaging/conversations/private/`
- `GET /messaging/conversations/groups/`
- `GET /messaging/conversations/{uuid}/messages/`
- WebSocket: `wss://.../ws/chat/`

---

### 3. **UserProfileContext** 👤

**Fichier:** `contexts/UserProfileContext.tsx`

**Responsabilités:**

- Stockage du profil utilisateur courant (avec questions/réponses)
- Synchronisation avec `AuthContext`

---

### 4. **JarvisContext** 🤖

**Fichier:** `contexts/JarvisContext.tsx`

**Responsabilités:**

- Historique des conversations avec Jarvis (assistant IA personnel)
- Envoi de messages à Jarvis
- Stockage local de l'historique

**API endpoint:**

- `POST /jarvis/chat/`

---

### 5. **AgentsContext** 🎭

**Fichier:** `contexts/AgentsContext.tsx`

**Responsabilités:**

- Liste des agents IA disponibles
- Agents actifs dans la conversation courante
- Sélection/désélection d'agents

**API endpoints:**

- `GET /agents/`
- `POST /agents/`
- `GET /agents/{uuid}/`

---

### 6. **NavigationContext** 🧭

**Fichier:** `contexts/NavigationContext.tsx`

**Responsabilités:**

- Navigation programmatique entre les tabs
- Référence au `SwipeableContainer` pour scroll/swipe

---

### 7. **TransitionContext** 🎬

**Fichier:** `contexts/TransitionContext.tsx`

**Responsabilités:**

- Gestion des animations de transition entre écrans

---

## 🔌 API Backend Django

### **Base URL**

```typescript
import { API_BASE_URL } from "@/config/api";
```

### **Authentification**

Tous les endpoints nécessitent le header:

```
Authorization: Bearer {accessToken}
```

**Utiliser TOUJOURS `makeAuthenticatedRequest()` du `AuthContext`** → gère automatiquement :

- Ajout du header Authorization
- Rafraîchissement du token si 401
- Déconnexion si refresh échoue

---

## 📡 Endpoints API principaux

### **Authentification**

| Méthode   | Endpoint                   | Description                                     |
| --------- | -------------------------- | ----------------------------------------------- |
| POST      | `/api/auth/register/`      | Créer un compte                                 |
| POST      | `/api/auth/login/`         | Se connecter (retourne access + refresh tokens) |
| POST      | `/api/auth/logout/`        | Se déconnecter                                  |
| POST      | `/api/auth/token/refresh/` | Rafraîchir le token                             |
| GET       | `/api/auth/profile/`       | Profil utilisateur connecté                     |
| PUT/PATCH | `/api/auth/profile/`       | Modifier le profil                              |
| GET       | `/api/auth/profile/stats/` | Statistiques utilisateur                        |

### **Messaging**

| Méthode | Endpoint                                       | Description                                    |
| ------- | ---------------------------------------------- | ---------------------------------------------- |
| GET     | `/messaging/conversations/`                    | Toutes les conversations                       |
| GET     | `/messaging/conversations/private/`            | Conversations 1-1 uniquement                   |
| GET     | `/messaging/conversations/groups/`             | Conversations de groupe uniquement             |
| GET     | `/messaging/conversations/{uuid}/messages/`    | Messages d'une conversation                    |
| POST    | `/messaging/conversations/send-first-message/` | Créer conversation + envoyer 1er msg           |
| POST    | `/messaging/conversations/{uuid}/send/`        | Envoyer un message                             |
| GET     | `/messaging/conversations/{uuid}/media/`       | Médias d'une conversation (images/videos/docs) |
| POST    | `/messaging/messages/{uuid}/mark_as_seen/`     | Marquer message comme lu                       |

### **Relations (connexions/amis)**

| Méthode | Endpoint                                 | Description                      |
| ------- | ---------------------------------------- | -------------------------------- |
| GET     | `/relations/connections/my-connections/` | Mes connexions                   |
| POST    | `/relations/invitations/send/`           | Envoyer une demande de connexion |
| GET     | `/relations/invitations/sent/`           | Demandes envoyées                |
| GET     | `/relations/invitations/received/`       | Demandes reçues                  |
| POST    | `/relations/invitations/{uuid}/accept/`  | Accepter une demande             |
| POST    | `/relations/invitations/{uuid}/decline/` | Refuser une demande              |
| DELETE  | `/relations/connections/{uuid}/remove/`  | Supprimer une connexion          |

### **Groupes**

| Méthode | Endpoint                              | Description         |
| ------- | ------------------------------------- | ------------------- |
| GET     | `/groups/my-groups/`                  | Mes groupes         |
| POST    | `/groups/`                            | Créer un groupe     |
| GET     | `/groups/{uuid}/`                     | Détails d'un groupe |
| POST    | `/groups/join-by-code/`               | Rejoindre via code  |
| POST    | `/groups/{uuid}/add-member/`          | Ajouter un membre   |
| DELETE  | `/groups/{uuid}/remove-member/`       | Retirer un membre   |
| POST    | `/groups/{uuid}/invite/`              | Inviter au groupe   |
| GET     | `/groups/invitations/received/`       | Invitations reçues  |
| POST    | `/groups/invitations/{uuid}/accept/`  | Accepter invitation |
| POST    | `/groups/invitations/{uuid}/decline/` | Refuser invitation  |

### **Agents IA**

| Méthode   | Endpoint                                            | Description                             |
| --------- | --------------------------------------------------- | --------------------------------------- |
| GET       | `/agents/`                                          | Liste des agents (publics + mes agents) |
| POST      | `/agents/`                                          | Créer un agent                          |
| GET       | `/agents/{uuid}/`                                   | Détails d'un agent                      |
| PUT/PATCH | `/agents/{uuid}/`                                   | Modifier un agent                       |
| DELETE    | `/agents/{uuid}/`                                   | Désactiver un agent                     |
| POST      | `/agents/{uuid}/interactions/`                      | Créer règle d'interaction               |
| POST      | `/conversations/{uuid}/agents/add/`                 | Ajouter agent à conversation            |
| DELETE    | `/conversations/{uuid}/agents/{agent_uuid}/remove/` | Retirer agent                           |

### **Jarvis (Assistant personnel)**

| Méthode | Endpoint            | Description                      |
| ------- | ------------------- | -------------------------------- |
| GET     | `/jarvis/instance/` | Instance Jarvis de l'utilisateur |
| POST    | `/jarvis/chat/`     | Envoyer un message à Jarvis      |
| GET     | `/jarvis/history/`  | Historique des conversations     |
| DELETE  | `/jarvis/history/`  | Effacer l'historique             |
| GET     | `/jarvis/stats/`    | Statistiques d'utilisation       |

### **Profils utilisateurs**

| Méthode | Endpoint                             | Description                          |
| ------- | ------------------------------------ | ------------------------------------ |
| GET     | `/profiles/{uuid}/`                  | Profil public d'un utilisateur       |
| GET     | `/questions/`                        | Questions disponibles pour le profil |
| POST    | `/profiles/questions/{uuid}/answer/` | Répondre à une question              |

### **Calendrier**

| Méthode   | Endpoint                     | Description         |
| --------- | ---------------------------- | ------------------- |
| GET       | `/calendrier/events/`        | Mes événements      |
| POST      | `/calendrier/events/`        | Créer un événement  |
| GET       | `/calendrier/events/{uuid}/` | Détails événement   |
| PUT/PATCH | `/calendrier/events/{uuid}/` | Modifier événement  |
| DELETE    | `/calendrier/events/{uuid}/` | Supprimer événement |

---

## 🔌 WebSocket - Messaging temps réel

### **Connexion**

```typescript
const ws = new WebSocket(
  "wss://reseausocial-production.up.railway.app/ws/chat/",
  ["access_token", accessToken] // Auth via subprotocols
);
```

### **Messages envoyés au serveur**

```typescript
// Envoyer un message
ws.send(
  JSON.stringify({
    type: "chat_message",
    content: "Hello!",
    conversation_uuid: "xxx-xxx-xxx",
  })
);

// Indicateur "en train d'écrire"
ws.send(
  JSON.stringify({
    type: "typing_start",
    conversation_uuid: "xxx-xxx-xxx",
  })
);

ws.send(
  JSON.stringify({
    type: "typing_stop",
    conversation_uuid: "xxx-xxx-xxx",
  })
);

// Marquer comme lu
ws.send(
  JSON.stringify({
    type: "mark_as_seen",
    conversation_uuid: "xxx-xxx-xxx",
  })
);
```

### **Messages reçus du serveur**

```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "chat_message":
      // Nouveau message reçu
      // data.message contient: { id, uuid, sender_username, content, created_at, ... }
      break;

    case "typing_status":
      // Un utilisateur tape
      // data.username, data.is_typing
      break;

    case "conversation_seen":
      // Message marqué comme lu
      // data.conversation_uuid
      break;

    case "error":
      // Erreur
      // data.message
      break;
  }
};
```

### **Gestion des erreurs**

```typescript
ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
  if (event.code === 4001) {
    // Authentification échouée
    // Rediriger vers login
  }
  console.log("WebSocket closed");
};
```

---

## 🎨 Composants principaux

### **DefaultAvatar**

**Fichier:** `components/DefaultAvatar.tsx`

Affiche les initiales d'un nom sur fond coloré.

```tsx
<DefaultAvatar name="John Doe" size={40} imageUrl={user.photo_profil_url} />
```

### **BottomBarV2**

**Fichier:** `components/BottomBar/BottomBarV2.tsx`

Barre contextuelle intelligente qui s'adapte selon l'écran :

- Mode **Chat** : envoi messages, pièces jointes, vocal, résumé
- Mode **Jarvis** : interface de discussion avec l'assistant
- **AgentPanel** : sélection d'agents IA pour la conversation

### **TypingIndicator**

**Fichier:** `components/TypingIndicator.tsx`

Animation "..." pour indiquer qu'un utilisateur tape.

### **SwipeableContainer**

**Fichier:** `components/SwipeableContainer.tsx`

Container avec swipe horizontal pour naviguer entre les 3 onglets principaux (Conversations / Home / Profil).

---

## 🎯 Écrans principaux

### **(tabs)/index.tsx** - 🏠 Home

- Page d'accueil avec résumés IA
- Navigation vers Jarvis et agents
- À développer : intégration résumés API

### **(tabs)/conversations.tsx** - 💬 Conversations

- Liste des conversations (privées + groupes)
- Grid 3 colonnes
- Indicateur visuel messages non lus (ombre verte)
- Pull-to-refresh
- Barre de recherche

### **(tabs)/conversation-direct.tsx** - Messages 1-1

- Affichage messages en temps réel (WebSocket)
- Messages propres à droite (bulles bleues)
- Messages reçus à gauche (bulles grises)
- Indicateurs de lecture (✓ / ✓✓)
- Support pièces jointes (images, vidéos, audio, documents)
- Header avec avatar + statut en ligne

### **(tabs)/conversation-group.tsx** - Messages de groupe

- Similaire à conversation-direct
- Affichage nom expéditeur pour chaque message
- Support résumé IA de la conversation

### **(tabs)/about.tsx** - 👤 Profil

- Profil utilisateur connecté
- Navigation vers stats, amis, groupes, settings

### **(screens)/agents.tsx** - 🎭 Marketplace Agents IA

- Liste agents publics + mes agents
- Création/édition d'agents
- Configuration instructions (system_prompt, language, formality_level)
- Ajout agents à conversations

### **(screens)/friends.tsx** - 👥 Connexions

- Onglets : Amis / Invitations
- Liste connexions actuelles
- Demandes reçues (accepter/refuser)
- Suppression connexions

### **(screens)/groups.tsx** - 👨‍👩‍👧‍👦 Groupes

- Liste mes groupes
- Création de groupes
- Génération code invitation
- Gestion membres
- Invitations reçues

### **(screens)/user-profile.tsx** - 🔍 Profil utilisateur

- Affichage profil public d'un autre utilisateur
- Questions/réponses
- Bouton "Envoyer message"
- Actions contextuelles selon statut relation

### **(screens)/conversation-media.tsx** - 🖼️ Médias

- Grid photos/vidéos d'une conversation
- Onglets : Photos / Documents
- Preview + download

---

## 🎨 Design System

### **Couleurs**

**Fichier:** `constants/colors.ts`

```typescript
export const ECHO_COLOR = "#da913eff"; // Orange principal
export const BACKGROUND_GRAY = "#f5f5f5"; // Fond clair
```

### **Styles globaux**

**Fichier:** `styles/appStyles.ts`

Styles réutilisables :

- Containers (`container`, `safeContainer`)
- Cartes de conversation
- Bulles de messages (`messageContainer`, `myMessage`, `otherMessage`)
- Inputs et boutons

---

## 🔐 Authentification - Flow

1. **Login/Register** → Récupère `access_token` + `refresh_token`
2. **Stockage sécurisé** → `SecureStore` (async)
3. **Tous les appels API** → `makeAuthenticatedRequest()`
   - Ajoute header `Authorization: Bearer {token}`
   - Si 401 → tente refresh token
   - Si refresh échoue → déconnexion + redirect login
4. **Persistence session** → Tokens rechargés au démarrage app

---

## 📦 Cache Strategy

Le `ChatContext` implémente un système de cache intelligent :

### **Cache en mémoire**

- **Messages** : `Map<conversationId, Message[]>`
- **Info conversations** : `Map<conversationId, ConversationInfo>`
- **Conversations privées** : `Conversation[]`
- **Conversations groupes** : `Conversation[]`
- **Connexions** : `User[]`
- **Groupes** : `Group[]`

### **Prefetch**

Lors du login, appel automatique à `prefetchConversationsOverview()` qui :

1. Charge toutes les conversations (privées + groupes)
2. Charge connexions, groupes, invitations
3. Précharge avatars en background
4. Stocke dans cache mémoire + `SecureStore`

Avantages :

- **Navigation instantanée** (pas de loading)
- **Mode offline partiel**
- **Réduction appels API**

---

## 🛠️ Patterns & Conventions

### **1. Appels API**

**❌ NE JAMAIS faire :**

```typescript
fetch(`${API_BASE_URL}/endpoint`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

**✅ TOUJOURS faire :**

```typescript
const { makeAuthenticatedRequest } = useAuth();
const response = await makeAuthenticatedRequest(`${API_BASE_URL}/endpoint`);
```

### **2. WebSocket**

- **Une connexion par conversation**
- **Toujours** fermer dans cleanup (`useEffect` return)
- Stocker la connexion dans `ChatContext` avec `setWebsocket()`

### **3. Navigation**

```typescript
import { router } from "expo-router";

// Naviguer vers un écran
router.push("/screens/user-profile?userId=123");

// Remplacer l'écran actuel
router.replace("/tabs/conversations");

// Retour arrière
router.back();
```

### **4. Gestion d'état local**

- **État local** → `useState` pour UI simple
- **État global** → Context pour données partagées
- **Cache** → `ChatContext` pour conversations/messages

### **5. TypeScript**

- **Toujours typer** les props, states, API responses
- Interfaces dans le fichier ou dans un dossier `/types`
- Éviter `any`, préférer `unknown` si type inconnu

### **6. Styles**

```typescript
// Réutiliser styles globaux
import { styles } from '@/styles/appStyles';

// Styles locaux avec StyleSheet.create()
const localStyles = StyleSheet.create({
  custom: { ... }
});

// Combiner
<View style={[styles.container, localStyles.custom]} />
```

---

## 🚀 Features Status

### ✅ Implémenté

- ✅ Authentification (login/register/logout)
- ✅ Persistence session (SecureStore)
- ✅ Liste conversations (privées + groupes séparées)
- ✅ Messages temps réel (WebSocket)
- ✅ Envoi/réception messages
- ✅ Pièces jointes (images/vidéos/audio/docs)
- ✅ Indicateurs lecture (✓ / ✓✓)
- ✅ Typing indicator
- ✅ Cache intelligent (prefetch)
- ✅ Gestion connexions/amis
- ✅ Groupes (création/gestion/invitations)
- ✅ Profils utilisateurs (view/edit)
- ✅ Questions/réponses profil
- ✅ Jarvis (assistant IA personnel)
- ✅ Agents IA (marketplace/création)
- ✅ Résumés IA conversations
- ✅ Bottom tabs navigation
- ✅ Swipe navigation entre tabs
- ✅ BottomBar contextuelle (chat/jarvis/agents)

### 🔨 À développer

- 🔨 Calendrier & événements (API prête, UI à faire)
- 🔨 Notifications push
- 🔨 Mode sombre
- 🔨 Paramètres app
- 🔨 Recherche globale messages
- 🔨 Réactions sur messages (emojis)
- 🔨 Édition/suppression messages
- 🔨 Statuts en ligne utilisateurs
- 🔨 Appels audio/vidéo
- 🔨 Stories/publications

---

## 🐛 Debugging Tips

### **Vérifier l'authentification**

```typescript
const { user, accessToken, isLoggedIn } = useAuth();
console.log("User:", user);
console.log("Token:", accessToken ? "Present" : "Missing");
console.log("Logged in:", isLoggedIn);
```

### **WebSocket issues**

```typescript
ws.onopen = () => console.log("✅ WS Connected");
ws.onerror = (e) => console.error("❌ WS Error:", e);
ws.onclose = (e) => console.log("🔴 WS Closed:", e.code, e.reason);
```

### **Cache inspection**

```typescript
const { getCachedPrivateConversations, getCachedMessages } = useChat();
console.log("Private convos:", getCachedPrivateConversations());
console.log("Messages:", getCachedMessages("conversation-uuid"));
```

### **API calls**

```typescript
const response = await makeAuthenticatedRequest(url);
console.log("Status:", response.status);
console.log("Data:", await response.json());
```

---

## 📖 Ressources

### **Documentation externe**

- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/)
- [Django Channels](https://channels.readthedocs.io/)

### **Documentation interne**

- **WebSocket Protocol** : Documentation complète du protocole WebSocket (voir project knowledge)
- **API Agents** : Documentation API agents IA (voir project knowledge)
- **API Jarvis** : Documentation API Jarvis (voir project knowledge)

---

## 🧭 Quick Reference - Où trouver quoi ?

| Besoin              | Fichier(s)                                                      |
| ------------------- | --------------------------------------------------------------- |
| Authentification    | `contexts/AuthContext.tsx`                                      |
| Appels API          | Utiliser `makeAuthenticatedRequest()` de `AuthContext`          |
| WebSocket setup     | `contexts/ChatContext.tsx` + `conversation-direct.tsx`          |
| Cache conversations | `contexts/ChatContext.tsx`                                      |
| Liste conversations | `(tabs)/conversations.tsx`                                      |
| Messages 1-1        | `(tabs)/conversation-direct.tsx`                                |
| Messages groupe     | `(tabs)/conversation-group.tsx`                                 |
| Profil utilisateur  | `(screens)/user-profile.tsx`, `contexts/UserProfileContext.tsx` |
| Agents IA           | `(screens)/agents.tsx`, `contexts/AgentsContext.tsx`            |
| Jarvis              | `contexts/JarvisContext.tsx`, composants `JarvisInteraction/`   |
| Connexions/amis     | `(screens)/friends.tsx`                                         |
| Groupes             | `(screens)/groups.tsx`                                          |
| Navigation tabs     | `(tabs)/_layout.tsx`                                            |
| BottomBar           | `components/BottomBar/BottomBarV2.tsx`                          |
| Styles globaux      | `styles/appStyles.ts`                                           |
| Couleurs            | `constants/colors.ts`                                           |
| Types               | Interfaces définies dans chaque fichier                         |

---

## 💡 Workflow de développement

### **Ajout d'une nouvelle feature**

1. **Identifier les contextes nécessaires**

   - Authentification ? → `AuthContext`
   - Messaging ? → `ChatContext`
   - Profil ? → `UserProfileContext`

2. **Créer l'écran**

   - Dans `(screens)/` pour écran secondaire
   - Dans `(tabs)/` si nouvel onglet principal

3. **Intégrer les hooks**

   ```typescript
   const { makeAuthenticatedRequest } = useAuth();
   const { getCachedMessages, prefetchConversation } = useChat();
   ```

4. **Typer les données**

   - Créer interfaces TypeScript
   - Typer les states et props

5. **Gérer les erreurs**

   - Try/catch sur appels API
   - Feedback utilisateur (Alert, Toast, etc.)

6. **Optimiser**
   - Utiliser cache si disponible
   - Prefetch en background
   - Loading states

### **Debugging d'un bug**

1. **Identifier la couche**

   - UI ? → Composant
   - État ? → Context
   - API ? → Network tab + logs backend

2. **Vérifier l'authentification**

   - Token présent ?
   - Token expiré ?
   - Permissions ?

3. **Logs ciblés**

   ```typescript
   console.log("🔍 Debug:", { variable1, variable2 });
   ```

4. **Tester en isolation**
   - Désactiver cache
   - Tester appel API direct
   - Vérifier réponse backend

---

## 🎓 Best Practices

### **Performance**

- ✅ Utiliser `useMemo` / `useCallback` pour calculs coûteux
- ✅ FlatList avec `keyExtractor` et `getItemLayout` pour grandes listes
- ✅ Prefetch en background
- ✅ Optimistic updates (UI react avant confirmation serveur)
- ❌ Éviter renders inutiles

### **Sécurité**

- ✅ Tokens dans SecureStore uniquement
- ✅ Valider inputs côté client
- ✅ HTTPS obligatoire en production
- ❌ Jamais logger tokens/passwords

### **Code Quality**

- ✅ TypeScript strict
- ✅ Composants réutilisables
- ✅ Noms explicites
- ✅ Commentaires pour logique complexe
- ❌ Éviter duplication de code

### **UX**

- ✅ Loading states clairs
- ✅ Messages d'erreur explicites
- ✅ Feedback immédiat (animations, états)
- ✅ Pull-to-refresh
- ❌ Jamais laisser l'utilisateur dans le vide

---

## 🆘 Common Issues

### **"Token expired" / 401 errors**

→ `makeAuthenticatedRequest()` gère automatiquement. Si problème persiste : vérifier refresh token validity.

### **WebSocket disconnects**

→ Implémenter reconnexion automatique avec backoff exponentiel.

### **Cache stale**

→ Utiliser pull-to-refresh ou invalider cache manuellement après mutations.

### **Images not loading**

→ Vérifier URLs complètes (base URL + path). Utiliser `expo-image` pour performance.

### **Navigation issues**

→ Vérifier structure dossiers `(tabs)` et `(screens)`. Utiliser `router.push()` avec chemins corrects.

---

## 📝 Notes importantes

- **Tous les appels API** doivent passer par `makeAuthenticatedRequest()`
- **Une seule WebSocket** par conversation active (gérer cleanup)
- **Cache** est prioritaire pour perf, mais peut être stale → refresh périodique
- **Prefetch** est lancé au login, pas besoin de le rappeler
- **TypeScript** strict → typer TOUT
- **Conventions de nommage** : camelCase variables, PascalCase composants
- **Fichiers** : kebab-case pour screens/components

---

**README généré le 9 novembre 2025**  
**Version 2.0 - Structure complète**
