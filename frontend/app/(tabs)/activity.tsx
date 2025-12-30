import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";
import { getToken } from "../../utils/token";
import {
    getCachedEmails,
    setCachedEmails,
    isCacheStale,
} from "../../services/emailCache";

type Email = {
    id: string;
    from: string;
    subject: string;
    date: string;
    status: "pending" | "accepted" | "rejected";
};

export default function ActivityScreen() {
    const router = useRouter();
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Add cache loading on mount
    useEffect(() => {
        const loadEmails = async () => {
            const cached = getCachedEmails();

            if (cached && !isCacheStale()) {
                setEmails(cached);
                setLoading(false);
                return;
            }

            await fetchJobRelatedEmails();
        };

        loadEmails();
    }, []);

    const fetchJobRelatedEmails = async (isRefresh = false) => {

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const token = await getToken();

            const res = await fetch(
                "https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev/email/job",
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
            setEmails(data);
            setCachedEmails(data);
        } catch (err) {
            console.error("Failed to fetch emails:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const statusColor = (s: Email["status"]) =>
        s === "accepted" ? "#28a745" : s === "rejected" ? "#dc3545" : "#ffc107";

        const renderItem = ({ item }: { item: Email }) => (
        <Pressable
            onPress={() =>
                router.push({
                    pathname: "/email/[id]",
                    params: { id: item.id },
                })
            }
            style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.7 },
            ]}
        >
            <Text style={styles.subject} numberOfLines={2}>
                {item.subject || "(No subject)"}
            </Text>

            <Text style={styles.sender}>{item.from}</Text>

            <View style={styles.metaRow}>
                <Text style={styles.date}>{formatDate(item.date)}</Text>
                <View
                    style={[
                        styles.badge,
                        { backgroundColor: statusColor(item.status) },
                    ]}
                >
                    <Text style={styles.badgeText}>
                        {(item.status ?? "pending").toUpperCase()}
                    </Text>
                </View>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.subtitle}>
                Recent internship-related emails
            </Text>

            {loading ? (
                <Text style={styles.empty}>Loading emails…</Text>
            ) : (
                <FlatList
                    data={emails}
                    keyExtractor={(item, index) =>
                        item.id ? item.id : `fallback-${index}`
                    }
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshing={refreshing}
                    onRefresh={() => fetchJobRelatedEmails(true)}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No emails found</Text>
                    }
                />
            )}

            <Pressable
                style={[styles.button, styles.backButton]}
                onPress={() => router.replace("/(tabs)/menu")}
            >
                <Text style={styles.buttonText}>Back to Menu</Text>
            </Pressable>
        </View>
    );
}

function formatDate(d: string) {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString();
}

const styles = StyleSheet.create({
    ...sharedStyles,
    subtitle: {
        color: "gray",
        marginBottom: 12,
        marginTop: 50,
        textAlign: "center",
    },
    list: {
        paddingTop: 8,
        paddingBottom: 48,
    },
    card: {
        backgroundColor: "#0f0f0f",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#222",
    },
    subject: {
        color: "#fff",
        fontWeight: "600",
        marginBottom: 6,
    },
    sender: {
        color: "gray",
        fontSize: 13,
        marginBottom: 4,
    },
    date: {
        color: "gray",
        fontSize: 12,
    },
    empty: {
        color: "gray",
        textAlign: "center",
        marginTop: 24,
    },
    backButton: {
        alignSelf: "center",
        width: "80%",
        marginTop: 12,
        marginBottom: 24,
    },
    metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        color: "#000",
        fontWeight: "700",
        fontSize: 11,
    },
});
