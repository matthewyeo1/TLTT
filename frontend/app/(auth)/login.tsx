import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { Link, useRouter } from "expo-router";
import { loginUser } from "../../services/authServices";
import { storeToken, getToken } from "../../utils/token";
import { sharedStyles } from "../styles/shared_styles";
import { BASE_URL } from "../../constants/api";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
      const result = await loginUser(email, password);
      console.log("Login result:", result);

      if (!result.ok) {
        setErrorMsg(result.error ?? "Login failed");
        setLoading(false);
        return;
      }

      const token = result.data?.token;
      if (token) {
        await storeToken(token);

        // Check if Gmail is linked
        const meRes = await fetch(`${BASE_URL}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          throw new Error(`Failed to fetch user info: ${meRes.status}`);
        }

        const userData = await meRes.json();

        // If Gmail not linked, fetch Google OAuth URL
        if (!userData.gmail?.accessToken) {
          const googleRes = await fetch(`${BASE_URL}/auth/google/link`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!googleRes.ok) {
            throw new Error(`Failed to fetch Google link URL: ${googleRes.status}`);
          }

          const { url } = await googleRes.json();
          Linking.openURL(url); 
          setLoading(false);
          return; 
        }
      }

      router.replace("../(tabs)/menu");
    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMsg(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      {errorMsg !== "" && <Text style={styles.error}>{errorMsg}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>

      <Link href="/(auth)/register" style={styles.link}>
        Don&apos;t have an account? Register
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  input: {
    ...sharedStyles.input,
  },
});
