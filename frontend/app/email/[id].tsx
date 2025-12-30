import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getToken } from "../../utils/token";

type EmailDetail = {
    id: string;
    from: string;
    subject: string;
    date: string;
    body: string;
};

export default function EmailDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [email, setEmail] = useState<EmailDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadEmail = async () => {
            try {
                const token = await getToken();
                const res = await fetch(
                    `https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev/email/${id}`,
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
        <ScrollView style={styles.container}>
            <Text style={styles.subject}>{email.subject}</Text>
            <Text style={styles.meta}>From: {email.from}</Text>
            <Text style={styles.meta}>Date: {email.date}</Text>

            <View style={styles.divider} />

            <Text style={styles.body}>{email.body}</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: "#000",
        flex: 1,
    },
    subject: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
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
