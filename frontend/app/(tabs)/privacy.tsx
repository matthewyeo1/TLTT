import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.paragraph}>
          This Privacy Policy explains how we collect, use, and protect your
          information when you use our application.
        </Text>

        <Text style={styles.heading}>Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect personal information such as your name, email address,
          and authentication credentials when you register or log in. We also
          collect limited technical data required to operate and secure the
          service.
        </Text>

        <Text style={styles.heading}>How We Use Information</Text>
        <Text style={styles.paragraph}>
          Your information is used solely to provide, maintain, and improve the
          service, including account authentication, security, and user support.
          We do not sell your personal information.
        </Text>

        <Text style={styles.heading}>Data Security</Text>
        <Text style={styles.paragraph}>
          We implement reasonable technical and organizational measures to
          protect your data. However, no system can be guaranteed to be 100%
          secure.
        </Text>

        <Text style={styles.heading}>Third Parties</Text>
        <Text style={styles.paragraph}>
          We do not share your personal data with third parties except where
          required by law or necessary to operate the service.
        </Text>

        <Text style={styles.heading}>Changes</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. Continued use of
          the app after changes indicates acceptance of the updated policy.
        </Text>
      </ScrollView>

      <Pressable style={[styles.button, { marginBottom: 30 }]} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back to Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
    marginTop: 80,
  },
  content: {
    paddingBottom: 30,
  },
  heading: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 6,
  },
  paragraph: {
    color: "gray",
    fontSize: 14,
    lineHeight: 20,
  },
});
