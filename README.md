# 📱 Echo - Application Mobile de Messagerie avec IA

## 🎯 Vue d'ensemble

Echo est une application mobile de messagerie moderne intégrant une marketplace d'agents IA. L'app permet aux utilisateurs de communiquer entre eux tout en bénéficiant d'agents intelligents pour automatiser et améliorer leurs conversations.

**Backend**: Django REST Framework (déjà développé)  
**Frontend**: React Native + Expo  
**URL API**: `https://reseausocial-production.up.railway.app`

---

## 📂 Structure du projet

### **Dossiers principaux**

```
echo-app/
├── app/                    # Pages et écrans de l'application
│   ├── (auth)/            # Écrans d'authentification
│   │   ├── login.tsx      # Page de connexion
│   │   └── register.tsx   # Page d'inscription
│   ├── (tabs)/            # Navigation par onglets (bottom tabs)
│   │   ├── index.tsx      # Page d'accueil avec résumés IA
│   │   ├── conversations.tsx  # Liste des conversations
│   │   ├── profile.tsx    # Profil utilisateur
│   │   └── _layout.tsx    # Configuration de la navigation tabs
│   ├── (screens)/         # Écrans additionnels
│   │   └── conversation-detail.tsx  # Détail d'une conversation
│   ├── _layout.tsx        # Layout principal de l'app
│   └── index.tsx          # Point d'entrée de l'application
├── components/            # Composants réutilisables
│   └── DefaultAvatar.tsx  # Avatar par défaut avec initiales
├── contexts/              # Contextes React
│   └── AuthContext.tsx    # Gestion de l'authentification
├── constants/             # Constantes de l'application
│   └── colors.ts          # Palette de couleurs
├── styles/                # Styles globaux
│   └── appStyles.ts       # Styles réutilisables
└── README.md              # Ce fichier
```

---

## 🔑 Fichiers clés et leurs rôles

### **1. `app/index.tsx`**
**Rôle**: Point d'entrée de l'application  
**Fonctionnalités**:
- Vérifie si l'utilisateur est connecté
- Redirige vers `/(tabs)` si authentifié
- Redirige vers `/(auth)/login` sinon
- Affiche un spinner pendant le chargement

### **2. `contexts/AuthContext.tsx`**
**Rôle**: Gestion centralisée de l'authentification  
**Fonctionnalités**:
- Stockage sécurisé des tokens JWT (access + refresh)
- Méthodes `login()`, `register()`, `logout()`
- Rafraîchissement automatique des tokens expirés
- Fonction `makeAuthenticatedRequest()` pour simplifier les appels API
- Persistence de la session avec SecureStore

**API utilisées**:
- `POST /api/auth/login/` - Connexion
- `POST /api/auth/register/` - Inscription
- `POST /api/auth/logout/` - Déconnexion
- `POST /api/auth/token/refresh/` - Rafraîchir le token

### **3. `app/(tabs)/index.tsx`**
**Rôle**: Page d'accueil avec résumés IA  
**Fonctionnalités**:
- Affiche un message de bienvenue personnalisé
- Liste les résumés de messages non lus (mock data pour l'instant)
- Point d'entrée vers la gestion des agents IA

**À développer**:
- Intégration avec l'API de résumés IA
- Affichage dynamique des notifications
- Navigation vers les agents IA

### **4. `app/(tabs)/conversations.tsx`**
**Rôle**: Liste des conversations actives  
**Fonctionnalités**:
- Récupère toutes les conversations de l'utilisateur
- Affiche un grid 3 colonnes de "carrés de conversation"
- Indicateur visuel pour les messages non lus (ombre verte)
- Pull-to-refresh pour actualiser
- Barre de recherche pour filtrer les conversations
- Navigation vers le détail d'une conversation

**API utilisées**:
- `GET /messaging/conversations/` - Liste des conversations

### **5. `app/(screens)/conversation-detail.tsx`**
**Rôle**: Affichage et envoi de messages dans une conversation  
**Fonctionnalités**:
- Connexion WebSocket pour les messages temps réel
- Affichage des messages (propres messages à droite, autres à gauche)
- Envoi de nouveaux messages
- Indicateurs de lecture (✓ / ✓✓)
- Header avec avatar et statut en ligne
- Auto-scroll vers le bas lors de nouveaux messages

**Technologies**:
- WebSocket pour le temps réel
- API REST pour récupérer l'historique des messages

**API utilisées**:
- `GET /messaging/conversations/{uuid}/messages/` - Historique
- WebSocket: `wss://reseausocial-production.up.railway.app/ws/chat/`

### **6. `components/DefaultAvatar.tsx`**
**Rôle**: Composant d'avatar réutilisable  
**Fonctionnalités**:
- Affiche les initiales du nom sur fond coloré
- Couleur générée automatiquement selon le nom
- Taille configurable
- Utilisé partout où un avatar est nécessaire

### **7. `app/(tabs)/_layout.tsx`**
**Rôle**: Configuration de la navigation bottom tabs  
**Fonctionnalités**:
- Définit les 4 onglets principaux (Home, Conversations, Agenda, Profile)
- Icônes et labels personnalisés
- Couleurs cohérentes avec la charte graphique

---

## 🔌 Communication avec le backend

### **Authentification**
Tous les appels API nécessitent un token JWT dans le header:
```
Authorization: Bearer <access_token>
```

Le `AuthContext` gère automatiquement:
- L'ajout du header Authorization
- Le rafraîchissement du token si expiré (401)
- La déconnexion si le refresh échoue

### **WebSocket pour le messaging**
Connexion WebSocket avec authentification JWT:
```javascript
const ws = new WebSocket(
  'wss://reseausocial-production.up.railway.app/ws/chat/',
  ['access_token', accessToken]
);
```

**Messages envoyés**:
- `chat_message` - Envoyer un message
- `typing_start` / `typing_stop` - Statut "en train d'écrire"
- `mark_as_seen` - Marquer comme lu

**Messages reçus**:
- `chat_message` - Nouveau message
- `typing_status` - Un utilisateur tape
- `conversation_seen` - Message marqué comme lu
- `error` - Erreur

---

## 🎨 Design et UI

### **Palette de couleurs**
Définie dans `constants/colors.ts`:
- `ECHO_COLOR`: `#da913eff` (Orange principal)
- `BACKGROUND_GRAY`: `#f5f5f5` (Fond clair)

### **Styles globaux**
Les styles réutilisables sont dans `styles/appStyles.ts`:
- Containers
- Cartes de conversation
- Messages (bulles)
- Inputs et boutons

---

## 🚀 Fonctionnalités actuelles

### ✅ Implémenté
- Inscription et connexion utilisateur
- Persistence de session (tokens stockés)
- Liste des conversations avec refresh
- Détail d'une conversation avec historique
- Envoi et réception de messages en temps réel (WebSocket)
- Page d'accueil avec résumés IA (mock)
- Navigation bottom tabs
- Gestion automatique des tokens expirés

### 🔨 À développer
- Marketplace d'agents IA
- Intégration des résumés IA (API)
- Envoi de fichiers/images
- Groupes de discussion
- Profil utilisateur complet
- Calendrier et événements
- Questions/réponses de profil
- Demandes de connexion
- Notifications push

---

## 📡 Endpoints API principaux utilisés

### Authentification
- `POST /api/auth/register/` - Créer un compte
- `POST /api/auth/login/` - Se connecter
- `POST /api/auth/logout/` - Se déconnecter
- `POST /api/auth/token/refresh/` - Rafraîchir le token
- `GET /api/auth/profile/` - Profil de l'utilisateur connecté

### Messaging
- `GET /messaging/conversations/` - Liste des conversations
- `GET /messaging/conversations/{uuid}/messages/` - Messages d'une conversation
- WebSocket `wss://.../ws/chat/` - Messages temps réel

### Groupes (à implémenter)
- `GET /groups/my-groups/` - Mes groupes
- `POST /groups/create/` - Créer un groupe
- `POST /groups/join-by-code/` - Rejoindre via code

### Calendrier (à implémenter)
- `GET /calendrier/events/` - Mes événements
- `POST /calendrier/events/` - Créer un événement

---

## 🛠️ Technologies utilisées

- **React Native** - Framework mobile multiplateforme
- **Expo** - Toolchain pour React Native
- **TypeScript** - Typage statique
- **Expo Router** - Navigation file-based
- **SecureStore** - Stockage sécurisé des tokens
- **WebSocket** - Communication temps réel
- **Fetch API** - Appels HTTP

---

## 📝 Prochaines étapes prioritaires

1. **Marketplace d'agents IA**
   - Écran de liste des agents disponibles
   - Ajout d'agents à un groupe
   - Configuration des agents

2. **Résumés IA**
   - Intégration avec l'endpoint de résumés
   - Affichage dynamique sur la page d'accueil

3. **Groupes**
   - Création de groupes
   - Ajout de membres
   - Conversations de groupe

4. **Fichiers et médias**
   - Upload d'images
   - Envoi de fichiers
   - Preview des médias

5. **Profil utilisateur**
   - Édition du profil
   - Photo de profil
   - Questions/réponses

---

## 🐛 Points d'attention

### Gestion des tokens
- Les tokens sont automatiquement rafraîchis
- Si le refresh échoue, l'utilisateur est déconnecté
- Toujours utiliser `makeAuthenticatedRequest()` du AuthContext

### WebSocket
- Une connexion par conversation active
- Penser à fermer la connexion dans le cleanup (useEffect)
- Gérer les reconnexions en cas de perte de connexion

### Performance
- Éviter de recharger les conversations à chaque render
- Utiliser `useMemo` / `useCallback` pour les calculs coûteux
- Pagination à implémenter pour les longues listes

---

## 📞 Contact & Support

Pour toute question sur l'architecture ou le fonctionnement:
- Documentation API complète dans les fichiers du projet
- Documentation WebSocket pour le messaging temps réel
- Vision produit dans "Objectif projet"