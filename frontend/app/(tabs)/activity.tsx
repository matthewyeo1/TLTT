import React, { 
    useEffect, 
    useState,
    useRef,
    useCallback 
} from "react";
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";
import { getToken } from "../../utils/token";
import {
    getCachedEmails,
    setCachedEmails,
    isCacheStale,
} from "../../services/emailCache";
import { MaterialIcons } from '@expo/vector-icons';

type Email = {
    id: string;
    from: string;
    subject: string;
    date: string;
    status: "pending" | "accepted" | "rejected" | "interview";
    autoReply?: {
        eligible: boolean;
        replied: boolean;
        repliedAt?: string;
        replyMessageId?: string;
    };
};

export default function ActivityScreen() {
    const router = useRouter();
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);
    const isFetchingRef = useRef(false);
    const [autoRefreshCount, setAutoRefreshCount] = useState(0);

    const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null);

    // Countdown state
    const REFRESH_INTERVAL = 20; // seconds
    const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

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

    // Auto-refresh every 20 seconds
    useFocusEffect(
        useCallback(() => {
            const interval = setInterval(async () => {
                await fetchJobRelatedEmails();
                setCountdown(REFRESH_INTERVAL);
            }, REFRESH_INTERVAL * 1000);

            return () => clearInterval(interval);
        }, [])
    );

    // Countdown ticker
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : REFRESH_INTERVAL));
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    const fetchJobRelatedEmails = async (
        source: "auto" | "manual" = "auto"
    ) => {

        if (isFetchingRef.current) return;
        
        isFetchingRef.current = true;

        if (source === "manual") {
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

            if (source === "auto") {
                setAutoRefreshCount((prev) => {
                    const next = prev + 1;
                    console.log(`Auto-refresh count: ${next}`);
                    return next;
                });
            }

        } catch (err) {
            console.error("Failed to fetch emails:", err);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    };

    const statusColor = (s: Email["status"]) =>
        s === "accepted" ? "#28a745" : s === "rejected" ? "#dc3545" : s === "interview" ? "#17a2b8" : "#ffc107";

    const renderItem = ({ item }: { item: Email }) => {
        const isLoading = loadingEmailId === item.id;

        return (
            <Pressable
                onPress={async () => {
                    setLoadingEmailId(item.id); // start loader
                    try {
                        router.push({
                            pathname: "/email/[id]",
                            params: { id: item.id },
                        });
                    } finally {
                        setLoadingEmailId(null); // stop loader
                    }
                }}
                style={({ pressed }) => [
                    styles.card,
                    pressed && { opacity: 0.7 },
                ]}
                disabled={isLoading} // prevent double press
            >
                <Text style={styles.subject} numberOfLines={2}>
                    {item.subject || "(No subject)"}
                </Text>

                <Text style={styles.sender}>{item.from}</Text>

                <View style={styles.metaRow}>
                    <Text style={styles.date}>{formatDate(item.date)}</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        
                        
                        {item.autoReply?.replied === true && (
                            <MaterialIcons
                                name="mark-email-read"
                                size={16}
                                color="#7B61FF"
                                marginRight={4}
                                style={{ marginLeft: 6 }}
                            />
                        )}

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
                </View>

                {isLoading && (
                    <View style={styles.overlayLoader}>
                        <ActivityIndicator size="small" color="#0d6efd" />
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.subtitle}>
                Refresh in: {countdown}s
            </Text>

            <FlatList
                data={emails}
                keyExtractor={(item, index) =>
                    item.id ? item.id : `fallback-${index}`
                }
                renderItem={renderItem}
                contentContainerStyle={[
                    styles.list,
                    emails.length === 0 && { flex: 1, justifyContent: 'center' },
                ]}
                refreshing={refreshing}
                onRefresh={() => {
                    fetchJobRelatedEmails("manual")
                    setCountdown(REFRESH_INTERVAL);
                }}
                ListEmptyComponent={
                    loading ? (
                        <Text style={styles.empty}>Loading emails…</Text>
                    ) : (
                        <Text style={styles.empty}>No emails found</Text>
                    )
                }
            />

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
    overlayLoader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },
});
