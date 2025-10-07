import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFound() {
  return (
    <View
      style={styles.container}
    >
      <Text style = {styles.text}>You re lost go back to home...</Text>
      <Link href={"/"} style={styles.button}> home</Link>
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
  },
  button:{
    fontSize: 20,
    textDecorationLine:"underline",
    color : "#881d68ff"
  },
});
