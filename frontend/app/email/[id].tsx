import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getToken } from "../../utils/token";
import { sharedStyles } from "../styles/shared_styles";
import { FETCH_EMAILS_URL } from "../../constants/api";

type EmailDetail = {
    id: string;
    from: string;
    subject: string;
    date: string;
    body: string;
};

export default function EmailDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [email, setEmail] = useState<EmailDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadEmail = async () => {
            try {
                const token = await getToken();
                const res = await fetch(
                    `${FETCH_EMAILS_URL}/${id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();
                setEmail(data);
            } catch (err) {
                console.error("Failed to load email:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEmail();
    }, [id]);

    if (loading) {
        return <Text style={styles.loading}>Loading email…</Text>;
    }

    if (!email) {
        return <Text style={styles.loading}>Email not found</Text>;
    }

    return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subject}>{email.subject || "(No subject)"}</Text>
        <Text style={styles.from}>From: {email.from}</Text>
        <Text style={styles.date}>Date: {email.date}</Text>

        <View style={styles.bodyContainer}>
          <Text style={styles.body}>{email.body}</Text>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.button, { marginTop: 145 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.buttonText}>Back to Emails</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
    ...sharedStyles,
    container: {
        padding: 50,
        backgroundColor: "#000",
        flex: 1,
        paddingHorizontal: 16,
    },
    bodyContainer: { marginTop: 12 },
    scrollContent: { paddingTop: 24, paddingHorizontal: 4, paddingBottom: 80 },
    subject: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
    from: { color: "gray", fontSize: 14, marginBottom: 4 },
    date: { color: "gray", fontSize: 12, marginBottom: 16 },
    meta: {
        color: "gray",
        fontSize: 13,
        marginBottom: 2,
    },
    divider: {
        height: 1,
        backgroundColor: "#222",
        marginVertical: 12,
    },
    body: {
        color: "#ddd",
        fontSize: 14,
        lineHeight: 20,
    },
    loading: {
        color: "gray",
        padding: 16,
        textAlign: "center",
    },
});
