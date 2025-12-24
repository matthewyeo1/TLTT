import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'jwtToken';

export const storeToken = async (token: string) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.error('Failed to store token:', err);
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to get token:', err);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to remove token:', err);
  }
};
