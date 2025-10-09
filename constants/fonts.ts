export const FONTS = {
  // Weights réguliers
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  
  // Weights italiques
  regularItalic: 'Poppins_400Regular_Italic',
  mediumItalic: 'Poppins_500Medium_Italic',
  semiBoldItalic: 'Poppins_600SemiBold_Italic',
  boldItalic: 'Poppins_700Bold_Italic',
  
  // Weights légers
  light: 'Poppins_300Light',
  extraLight: 'Poppins_200ExtraLight',
  
  // Weights lourds
  extraBold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black',
} as const;

// Helper pour faciliter l'utilisation
export const getFontFamily = (weight: keyof typeof FONTS = 'regular') => {
  return FONTS[weight];
};

