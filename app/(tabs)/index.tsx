import React, { useState, useEffect } from 'react';
import { Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";

import DefaultAvatar from "@/components/DefaultAvatar";
import { ECHO_COLOR, BACKGROUND_GRAY } from "@/constants/colors";


export default function HomePage() {
  const { user } = useAuth();

  // Mock data - plus tard vous pourrez appeler une vraie API IA
  const aiSummary = [
    { id: 1, sender: "Raphael", message: "Raphael is basically just cassing your couilles, no need to answer." },
    { id: 2, sender: "Ralph", message: "Ralph still hasn't answered your question, should I tell him he is a connard?" },
    { id: 3, sender: "Antoine", message: "Antoine won't be there this weekend, so i complained that he is never here." },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Welcome {user?.username}, you have 10 new messages. I'll sum them up for you.
      </Text>

      {aiSummary.map((item) => (
        <View key={item.id} style={styles.summaryCard}>
          <View style={styles.avatar} />
          <Text style={styles.summaryText}>{item.message}</Text>
        </View>
      ))}

      <View style={styles.summaryCard}>
        <View style={styles.avatar} />
        <Text style={styles.summaryText}>Manage your AI agents by clicking on this notification</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
  },
  content: {
    padding: 20,
    paddingBottom: 200,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5a5a7a',
    marginBottom: 30,
    lineHeight: 32,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d0d0d0',
    marginRight: 15,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
});