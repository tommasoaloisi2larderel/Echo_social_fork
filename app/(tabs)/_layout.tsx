import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  console.log('📱 TabsLayout loaded!');
  console.log('📱 Tabs enfants disponibles'); // Pour voir ce qui se passe
  
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: "#da913eff"
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
  );
}