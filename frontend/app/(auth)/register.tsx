import { useState } from "react";
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { registerUser } from "../../services/authServices";

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
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 24,
  },
  input: {
    width: "100%",
    padding: 14,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    color: "#fff",
  },
  button: {
    width: "100%",
    backgroundColor: "#007bff",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  error: {
    color: "red",
    marginBottom: 8,
    textAlign: "center",
  },
  link: {
    marginTop: 8,
    color: "#007bff",
    textAlign: "center",
    fontSize: 14,
  },
});
