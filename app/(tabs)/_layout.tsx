import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { useState } from "react";
import BottomBar from "../../components/BottomBar";



export default function TabsLayout() {
  const [chatText, setChatText] = useState("");
  const pathname = usePathname();
  
  // Fonction pour envoyer un message (sera utilisée par la BottomBar en mode chat)
  const handleSendMessage = () => {
    // Cette fonction sera appelée par la BottomBar quand on est en mode chat
    console.log("Envoi du message:", chatText);
    // Ici vous pouvez ajouter la logique d'envoi de message
    setChatText(""); // Vider le champ après envoi
  };
  
  return (
    <>
      <Tabs screenOptions={{
        tabBarActiveTintColor: "#da913eff",
        tabBarStyle: { display: 'none' }, // Masquer la tab bar native
        headerShown : false
      }}>
        <Tabs.Screen 
          name="index" 
          options={{
            headerTitle: "So fun",
            tabBarIcon: ({focused, color}) => (
              <Ionicons 
                name={focused ? "home-sharp" : "home-outline"} 
                color={color}  
                size={24}
              />
            )
          }}
        /> 

        <Tabs.Screen 
          name="conversations" 
          options={{
            headerTitle: "Messages",
            tabBarIcon: ({focused, color}) => (
              <Ionicons 
                name={focused ? "chatbubbles" : "chatbubbles-outline"} 
                color={color}  
                size={24}
              />
            )
          }}
        />
        
        <Tabs.Screen 
          name="about"
          options={{
            headerTitle: "Let's talk about us !",
            tabBarIcon: ({focused, color}) => (
              <Ionicons 
                name={focused ? "information-circle" : "information-circle-outline"} 
                color={color}  
                size={24}
              />
            )
          }}
        />

        <Tabs.Screen 
          name="conversation-detail"
          options={{
            headerTitle: "Conversation",
            tabBarIcon: ({focused, color}) => (
              <Ionicons 
                name={focused ? "chat" : "chat-outline"} 
                color={color}  
                size={24}
              />
            )
          }}
        />
      </Tabs>
      
      {/* BottomBar personnalisé */}
      <BottomBar 
        currentRoute={pathname}
        chatText={chatText}
        setChatText={setChatText}
        chatRecipient={pathname.includes('conversation-detail') ? "Contact" : ""}
        onSendMessage={pathname.includes('conversation-detail') ? handleSendMessage : undefined}
      />
    </>
  );
}