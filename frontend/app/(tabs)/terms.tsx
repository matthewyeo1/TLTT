import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Terms of Service</Text>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.paragraph}>
          These Terms of Service govern your use of the application. By accessing
          or using the app, you agree to be bound by these terms.
        </Text>

        <Text style={styles.heading}>Use of the Service</Text>
        <Text style={styles.paragraph}>
          You agree to use the service only for lawful purposes and in accordance
          with all applicable laws and regulations.
        </Text>

        <Text style={styles.heading}>Account Responsibility</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activities that occur under your
          account.
        </Text>

        <Text style={styles.heading}>Prohibited Conduct</Text>
        <Text style={styles.paragraph}>
          You may not misuse the service, attempt unauthorized access, interfere
          with system integrity, or engage in activity that disrupts the
          application.
        </Text>

        <Text style={styles.heading}>Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          The service is provided on an “as is” basis. To the fullest extent
          permitted by law, we disclaim all warranties and shall not be liable
          for any damages arising from your use of the service.
        </Text>

        <Text style={styles.heading}>Termination</Text>
        <Text style={styles.paragraph}>
          We reserve the right to suspend or terminate access to the service at
          our discretion, without notice, for conduct that violates these terms.
        </Text>

        <Text style={styles.heading}>Changes</Text>
        <Text style={styles.paragraph}>
          We may modify these Terms of Service at any time. Continued use of the
          service constitutes acceptance of the updated terms.
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
