import { useState } from "react";
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { registerUser } from "../../services/authServices";
import { sharedStyles } from "../styles/shared_styles";

export const screenOptions = {
  headerShown: false,
};

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");
    console.log("Register request body:", { name, email, password }); 

    try {
        const res = await registerUser(name, email, password);

        console.log("Register response status:", res.status);

        if (!res.ok) {
            setError(res.error || "Registration failed");
            return;
        }

        router.replace("/(auth)/login");
    } catch (err: any) {
        console.error("Register fetch error:", err);
        setError("Network error: " + err.message);
    }
 };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Create Account" onPress={handleRegister} />

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account?
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
