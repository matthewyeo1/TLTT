import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'jwtToken';
const GMAIL_TOKENS_KEY = 'gmailTokens';

export type GmailTokens = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
};

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

export const storeGmailTokens = async (tokens: GmailTokens) => {
  try {
    await AsyncStorage.setItem(GMAIL_TOKENS_KEY, JSON.stringify(tokens));
  } catch (err) {
    console.error('Failed to store Gmail tokens:', err);
  }
};

export const getGmailTokens = async (): Promise<GmailTokens | null> => {
  try {
    const raw = await AsyncStorage.getItem(GMAIL_TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to get Gmail tokens:', err);
    return null;
  }
};

export const removeGmailTokens = async () => {
  try {
    await AsyncStorage.removeItem(GMAIL_TOKENS_KEY);
  } catch (err) {
    console.error('Failed to remove Gmail tokens:', err);
  }
};

