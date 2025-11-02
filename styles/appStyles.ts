import { StyleSheet } from "react-native";
import { BACKGROUND_GRAY, DARK_GRAY, ECHO_COLOR, LIGHT_GRAY, WHITE } from "../constants/colors";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
    justifyContent: "center",
    alignItems: "center",
  },

  ///////////////////////////////////////STYLES FOR CONVERSATIONS PAGE
  searchContainer: { 
    position: "absolute", 
    top: 70, 
    left: 20, 
    right: 20, 
    backgroundColor: "rgba(255,255,255,0.6)", 
    borderRadius: 25, 
    shadowColor: WHITE, 
    shadowOpacity: 0.9, 
    elevation: 5, 
    paddingHorizontal: 15, 
    paddingVertical: 5, 
    zIndex : 10,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 8,
    color: DARK_GRAY,
  },
  conversationGrid: {
    paddingTop: 105,
    paddingBottom: 380,
    paddingHorizontal: 10,
  },
  row: {
    justifyContent: "center",
    marginBottom: 20,
  },
  conversationSquare: { 
    width: 110, 
    height : 110,
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: LIGHT_GRAY, 
    marginHorizontal: 6, 
    borderRadius: 25, 
    paddingTop: 0, 
    paddingBottom: 0, 
    shadowColor: "rgba(10, 145, 104, 0.4)", 
    shadowOffset: { height : 0, width : 0},
    shadowOpacity: 1, 
    shadowRadius: 5,
    elevation: 5,
  },
  unreadConversationSquare: {
    shadowColor: "rgba(38, 201, 23, 0.8)",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10, // Augmente l'elevation pour Android
    backgroundColor: "white", // Fond blanc pour contraster
    borderWidth: 2,
    borderColor: "rgba(10, 145, 104, 0.4)",
  },
  
  unreadWrapper: {
    borderRadius: 30,
    padding: 4,
    backgroundColor: "rgba(10, 145, 104, 0.2)",
    shadowColor: "rgba(10, 145, 104, 0.6)",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },


  avatar: {
    width: 110,
    height: 110,
    borderRadius: 25,
  },
  conversationNameBadge: {
    position: "absolute",
    bottom: 8,
    left: 10,
    right: 10,
    opacity: 0.6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 4,
    zIndex: 10,
    shadowColor: WHITE,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  conversationNameText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  ///////////////////////////////////////// STYLES FOR CHAT PAGE
  chatContainer: {
    flex: 1,
    backgroundColor: "rgba(245,250,245,0.9)",
  },
  chatHeader: {
    position: "absolute",
    top: 60,
    left: 70,
    right: 20,
    backgroundColor: "rgba(230,230,230,0.7)",
    borderRadius: 40,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: DARK_GRAY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10,
  },
  chatHeaderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    marginRight: 12,
  },
  chatHeaderName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
    flex: 1,
  },
  chatHeaderStatus: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    fontSize: 20,
    color: ECHO_COLOR,
    fontWeight: "bold",
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  messagesContainer: {
    paddingTop: 115,
    paddingBottom: 100,
    paddingHorizontal: 12,
  },
  messageBubble: {
    marginVertical: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: "80%",
    shadowColor: WHITE,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  myMessage: {
    alignSelf: "flex-end",
    opacity: 0.7,
    backgroundColor: ECHO_COLOR,
    shadowColor: "#888",
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(230,230,230,0.7)",
    shadowColor: WHITE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: WHITE,
    fontWeight: "500",
  },
  theirMessageText: {
    color: "rgba(60,60,60,0.9)",
  },

  messageMeta: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
    marginBottom: 0,
    gap: 8,
  },

  timestampText: {
    fontSize: 10,
    color: "#083b0fff",
  },

  readStatus: {
    fontSize: 10,
    color: "#083b0fff",
    fontWeight: "500",
  },
  writing : {
    fontSize: 10,
    color: "#083b0fff",
    fontWeight: "500",
  },

  // Styles pour les messages groupés
  firstMessageOverall: {
    marginTop: 0,  // Réduire l'espace en haut du premier message
  },

  messageGrouped: {
    marginTop: 1,  // Réduire l'espace entre les messages groupés
    marginBottom: 1,
  },

  // Messages de l'utilisateur (à droite) - Premier du groupe
  myMessageFirst: {
    borderBottomRightRadius: 8,  // Réduire le rayon en bas à droite
  },

  // Messages de l'utilisateur (à droite) - Milieu du groupe
  myMessageMiddle: {
    borderTopRightRadius: 8,     // Réduire le rayon en haut à droite
    borderBottomRightRadius: 8,  // Réduire le rayon en bas à droite
  },

  // Messages de l'utilisateur (à droite) - Dernier du groupe
  myMessageLast: {
    borderTopRightRadius: 8,     // Réduire le rayon en haut à droite
  },

  // Messages des autres (à gauche) - Premier du groupe
  theirMessageFirst: {
    borderBottomLeftRadius: 8,   // Réduire le rayon en bas à gauche
  },

  // Messages des autres (à gauche) - Milieu du groupe
  theirMessageMiddle: {
    borderTopLeftRadius: 8,      // Réduire le rayon en haut à gauche
    borderBottomLeftRadius: 8,   // Réduire le rayon en bas à gauche
  },

  // Messages des autres (à gauche) - Dernier du groupe
  theirMessageLast: {
    borderTopLeftRadius: 8,      // Réduire le rayon en haut à gauche
  },

  // Séparateur de date
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  dateText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    borderRadius: 10,
  },

  // Messages système
  systemMessageContainer: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
    borderRadius: 14,
    maxWidth: '85%',
  },
  systemMessageText: {
    fontSize: 12,
    color: 'rgba(10, 145, 104, 0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Wrapper de message
  messageWrapper: {
    marginBottom: 1,
  },

  // Nom de l'expéditeur
  senderName: {
    fontSize: 11,
    color: '#777',
    marginLeft: 10,
    marginBottom: 2,
    fontWeight: '600',
  },
  

  ///////////////////////////////////////// STYLES FOR HOME PAGE
  homeContainer: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  headerContainer: {
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "rgba(10, 145, 104, 1)",
    marginBottom: 10,
    marginTop: 20,
  },
  subtitleText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: "#ff6b6b",
    borderRadius: 10,
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  logoutButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: '#333',
    marginBottom: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  notificationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(240, 240, 240, 0.2)",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 12,
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 7,
    elevation: 3,
  },
  notificationProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  conversationInfo: {
    flex: 1,
    position: 'relative',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: "#777",
    flex: 1,
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: ECHO_COLOR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: 'bold',
  },

  //////////////////////////////////////// STYLES FOR PROFILE PAGE
  profilePicture: {
    borderRadius: 60,
    width: 120,
    height: 120,
    alignSelf: "center",
    marginBottom: 15,
  },
  pseudo: {
    textAlign: "center",
    fontSize: 30,
    fontWeight: "bold",
    color: "rgba(70,70,130,0.5)",
  },

  ///////////////////////////////////// STYLES FOR BOTTOM BAR
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10, 145, 104, 0.8)",
    borderTopLeftRadius: 46,
    borderTopRightRadius: 46,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingVertical: 5,
    paddingHorizontal: 20,
    paddingBottom: 10,
    shadowColor: "rgba(10, 145, 104, 0.8)", 
    shadowOpacity: 0.6, 
    shadowRadius: 7,
    elevation: 0,
  },

  chatSection: {
    backgroundColor: "rgba(250,250,250,0.9)",
    borderRadius: 35,
    paddingHorizontal: 25,
    paddingVertical: 8,
    marginBottom: 8,
    shadowColor: "rgba(255, 255, 255, 0.6)", 
    shadowOpacity: 0.5, 
    shadowRadius: 5, 
    elevation: 5,
  },
  chatInput: {
    fontSize: 16,
    color: "#444",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 0,
    backgroundColor: "rgba(70,70,130,0.)",
    borderRadius: 35,
    paddingHorizontal: 25,
    elevation: 5,
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
  },
  navText: {
    color: "rgba(240, 240, 240, 0.8)",
    fontSize: 16,
    fontWeight: "bold",
  },

///////////////////////////////////////// STYLES FOR SUMMARY FEATURE
  summaryButton: {
    position: 'absolute',
    bottom: 112,
    alignSelf : 'center',
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  summaryBubble: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    marginHorizontal: 20,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 24, // Coins plus arrondis
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: 320,
    borderWidth: 2,
    borderColor: 'rgba(10, 145, 104, 0.1)', // Bordure verte subtile
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 4, // Réduire l'espace
  },
  summaryCloseButton: {
    position : 'absolute',
    top : 8,
    right : 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex:10,
  },
  summaryContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    paddingRight: 40,
    paddingTop: 4,
  },
  summaryScrollContent: {
    paddingRight: 4,
  },

  profileAvatar: {
  width: 60,
  height: 60,
  borderRadius: 30,
  borderWidth: 3,
  borderColor: '#fff',
},
});


