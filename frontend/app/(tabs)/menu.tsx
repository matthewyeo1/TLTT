import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { sharedStyles } from "../styles/shared_styles";
import { removeToken, getToken } from "../../utils/token";
import { clearEmailCache } from "../../services/emailCache";
import { BASE_URL, FETCH_USER_INFO_URL } from "../../constants/api";

type Logs = {
  _id: string;
  company: string;
  role: string;
  status: "interview" | "accepted";
  updatedAt: string;
};

export default function MenuScreen() {

  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Logs[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      const token = await getToken();
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      try {
        const res = await fetch(FETCH_USER_INFO_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`);

        const data = await res.json();
        setUserName(data.name || data.email || "User"); // adjust keys to your API
      } catch (err) {
        console.error("Error fetching user info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Load logs
  useEffect(() => {
    const loadNotifications = async () => {
      const token = await getToken();

      try {
        const res = await fetch(`${BASE_URL}/email/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load notifications");

        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLogs(false);
      }
    };

    loadNotifications();
  }, []);

  // Logout handler
  const handleLogout = async () => {
    await removeToken();
    clearEmailCache();
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={styles.empty}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Welcome, {userName} 👋</Text>
        </View>
        <View style={styles.topIcons}>
          <Pressable style={styles.iconButton} /* onPress={() => router.push("/settings")} */>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={async () => {
              handleLogout();
            }}
          >
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.notificationsBox}>
        <Text style={styles.notificationsTitle}>Notifications</Text>

        {loadingLogs ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : logs.length === 0 ? (
          <Text style={styles.empty}>No action required</Text>
        ) : (
          logs.map(n => (
            <Pressable
              key={n._id}
              style={styles.notificationItem}
              onPress={() =>
                router.push({
                  pathname: "/activity",
                  params: { jobId: n._id },
                })
              }
            >
              <Text style={styles.notificationType}>
                {n.status === "interview" ? "Interview" : "Offer"}
              </Text>

              <Text style={styles.notificationText}>
                {n.company} — {n.role}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable
        style={styles.bottomButton}
        onPress={() => router.push("/activity")}
      >
        <Text style={styles.bottomButtonText}>View Activity</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  container: {
    ...sharedStyles.container,
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: "#000",
    paddingTop: 80,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topIcons: {
    flexDirection: "row",
    gap: 16,
  },
  iconButton: {
    marginBottom: 20,
    padding: 2,
  },
  title: {
    ...sharedStyles.title,
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  notificationsBox: {
    flex: 1,
    marginVertical: 40,
    backgroundColor: "#241c1cff",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  notificationsText: {
    color: "#999",
    fontSize: 16,
  },
  bottomButton: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: "#007bff",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  bottomButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  empty: {
    color: "gray",
    textAlign: "center",
    marginTop: 24,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#f4f6fb",
    marginBottom: 10,
  },
  notificationType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007bff",
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 15,
    color: "#333",
  },
});
