import { Text, View, StyleSheet } from "react-native";

export default function AboutScreen() {
  return (
    <View
      style={styles.container}
    >
      <Text style = {styles.text}>This place shall talk only about us !!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor : "#b89d25ff"

  },
  text :{
    color : "#0a3075ff"
  }
});
