import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";
import { removeToken } from "../../utils/token";
import { clearEmailCache } from "../../services/emailCache";

export default function MenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome 👋</Text>
      <Text style={styles.subtitle}>What would you like to do?</Text>

      <Pressable style={styles.button} onPress={() => router.push("/activity")}>
        <Text style={styles.buttonText}>Activity</Text>
      </Pressable>

      <Pressable style={styles.button} /*onPress={() => router.push("/settings")}*/>
        <Text style={styles.buttonText}>Settings</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.logoutButton]}
        onPress={async () => {
            await removeToken(); 
            clearEmailCache();
            router.replace("/(auth)/login"); 
        }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  input: {
    ...sharedStyles.input,
  },
  title: {
    ...sharedStyles.title,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    color: "gray",
    marginBottom: 30,
  },
  button: {
    width: "80%",
    paddingVertical: 14,
    backgroundColor: "#007bff",
    borderRadius: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#eee",
  },
  logoutText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
  },
});
