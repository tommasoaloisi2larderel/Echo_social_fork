import { Text, View, StyleSheet } from "react-native";
import {Image} from "expo-image"
import ImageViewer from "@/components/ImageViewer";
import Button from "@/components/Button";
import * as ImagePicker from "expo-image-picker"
import { useState } from "react";

const PlaceholderImage = require("../../assets/images/test.jpg")

export default function Index() {

  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined
  );

  const pickImageAsync = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled){
      setSelectedImage(result.assets[0].uri)
      console.log(result);
    } else {
      alert("You did something wrong. Please try again.")
    }
  }


  return (
    <View style={styles.container} >
      <View style = {styles.imageContainer}>
        <ImageViewer imgSource={selectedImage || PlaceholderImage}/>
      </View>
      <View style={styles.footerContainer}>
        <Button label= "Choose a photo" onPress={pickImageAsync}/>
        <Button label= "Use this photo"/>
      </View>
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
  image: {
    width: 320,
    height:440,
    borderRadius : 18,
  },
  imageContainer : {
    flex :1,
  },
  footerContainer : {
    flex: 1 / 3,
    alignItems: "center",
  },
});
