import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getToken } from "../../utils/token";
import { sharedStyles } from "../styles/shared_styles";
import { CHANGE_GMAIL_URL, PROTECTED_ROUTE } from "../../constants/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()\[\]{};:'"\\|,<.>\/?`~\-+=_]/;

export default function ProfileScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${PROTECTED_ROUTE}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        setEmail(body?.user?.email || "");
      } catch (err) {
        // silent fail — leave email blank
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validate = () => {
    if (!email || !EMAIL_REGEX.test(email)) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return false;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        Alert.alert("Validation", "New password must be at least 8 characters.");
        return false;
      }

      if (!SPECIAL_CHAR_REGEX.test(newPassword)) {
        Alert.alert("Validation", "New password must include at least one special character.");
        return false;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Validation", "New password and confirmation do not match.");
        return false;
      }
      if (!currentPassword) {
        Alert.alert("Validation", "Please enter your current password to change it.");
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Not authenticated", "Please log in again.");
        setSaving(false);
        return;
      }

      // Replace endpoint with your actual profile update route
      const res = await fetch(`${CHANGE_GMAIL_URL}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = body?.error || `Update failed (${res.status})`;
        Alert.alert("Save failed", msg);
      } else {
        Alert.alert("Saved", "Profile updated successfully.");
        // clear password fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      Alert.alert("Network error", err?.message || "Failed to reach server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <View style={styles.emailRow}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {loading ? (
          <ActivityIndicator 
            style={styles.loadingIndicator}
            size="small"
            color="#fff"
          />
        ) : null}
      </View>

      <Text style={styles.label}>Current Password</Text>
      <TextInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        style={styles.input}
        secureTextEntry
      />

      <Text style={styles.label}>New Password</Text>
      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
        secureTextEntry
        placeholder="Leave blank to keep current password"
      />

      <Text style={styles.label}>Confirm New Password</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
        secureTextEntry
      />

      <Pressable
        style={[styles.button, styles.saveButton]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? "Saving…" : "Save Changes"}</Text>
      </Pressable>

      <Pressable style={[ styles.button, { marginTop: 300 }]} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back to Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#000",
    marginTop: 80,
  },
  label: {
    color: "gray",
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
    fontSize: 13,
    borderColor: "gray",
    borderRadius: 1,
  },
  input: {
    ...sharedStyles.input,
    marginBottom: 6,
    borderColor: "#333",
  },
  saveButton: {
    marginTop: 18,
    width: "100%",
  },
  emailRow: {
    position: "relative",
    width: "100%",
  },
  loadingIndicator: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -13,
  },
});