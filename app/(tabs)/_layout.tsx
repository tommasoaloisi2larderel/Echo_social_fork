import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { usePathname } from "expo-router";
import BottomBar from "../../components/BottomBar";



export default function TabsLayout() {
  const [chatText, setChatText] = useState("");
  const pathname = usePathname();
  
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
      </Tabs>
      
      {/* BottomBar personnalisé */}
      <BottomBar 
        currentRoute={pathname}
        chatText={chatText}
        setChatText={setChatText}
      />
    </>
  );
}