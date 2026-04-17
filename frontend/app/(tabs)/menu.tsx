import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import { sharedStyles } from "../styles/shared_styles";
import { removeToken, getToken } from "../../utils/token";
import { clearEmailCache } from "../../services/emailCache";
import {
  BASE_URL,
  FETCH_USER_INFO_URL,
  FETCH_INTERVIEW_EMAILS_URL,
  INIT_SCHEDULE_INTERVIEW_URL
} from "../../constants/api";

type Logs = {
  _id: string;
  company: string;
  role: string;
  status: "interview" | "accepted" | "online_assessment" | "coding_task";
  interviewSubtype?: "online_assessment" | "schedule_interview" | "unspecified";
  updatedAt: string;
  scheduling?: {
    scheduleId: string;
    status: "pending" | "scheduled" | "cancelled";
    timezone?: string;
    selectedSlot?: {
      start?: string;
      end?: string;
    };
    calendarEventId?: string;
  } | null;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  reauthUrl?: string;
  connectUrl?: string;
};

function formatNotificationType(status: Logs["status"], subtype?: Logs["interviewSubtype"]) {
  if (status === "accepted") return "Offer";
  if (status === "interview") {
    if (subtype === "online_assessment") return "Online Assessment";
    if (subtype === "schedule_interview") return "Interview Scheduling";
    return "Interview";
  }
  return "";
}

const buildErrorMessage = (payload?: ApiErrorPayload, fallback?: string) => {
  const baseMessage = payload?.error || payload?.message || fallback || "Something went wrong.";
  const actionUrl = payload?.reauthUrl || payload?.connectUrl;
  if (actionUrl) {
    return `${baseMessage}\n\nReconnect Google here:\n${actionUrl}`;
  }
  return baseMessage;
};

const formatScheduledSlot = (
  start?: string,
  end?: string,
  timezone?: string
) => {
  if (!start || !end) return null;
  const startTime = DateTime.fromISO(start).toLocal();
  const endTime = DateTime.fromISO(end).toLocal();
  return `${startTime.toFormat("DDD")} • ${startTime.toFormat("hh:mm a")} - ${endTime.toFormat("hh:mm a")} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
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
        setUserName(data.name || data.email || "User");
      } catch (err) {
        console.error("Error fetching user info:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Load logs – extracted as a reusable function
  const loadNotifications = useCallback(async () => {
    setLoadingLogs(true);
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const res = await fetch(FETCH_INTERVIEW_EMAILS_URL, {
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
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Logout handler
  const handleLogout = async () => {
    await removeToken();
    clearEmailCache();
    router.replace("/(auth)/login");
  };

  // Initialize schedule for a given log
  const initSchedule = async (logId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        router.replace("/(auth)/login");
        return;
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(INIT_SCHEDULE_INTERVIEW_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailId: logId, timezone }),
      });
      const rawText = await res.text();
      let data: ApiErrorPayload & { _id?: string } = {};
      if (rawText) {
        try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }
      }
      if (!res.ok) {
        const message = buildErrorMessage(data, `Failed to start schedule (${res.status}).`);
        Alert.alert("Unable to start scheduling", message);
        throw new Error(message);
      }
      if (!data._id) throw new Error("Schedule was created without an id.");
      router.push(`/schedule/${data._id}`);
    } catch (err) {
      console.error("Failed to start schedule:", err);
      if (err instanceof Error && err.message !== "Schedule was created without an id.") return;
      Alert.alert(
        "Unable to start scheduling",
        err instanceof Error ? err.message : "Please try again."
      );
    }
  };

  // Cancel interview handler
  const cancelInterview = async (scheduleId: string, logId: string) => {
    Alert.alert(
      "Cancel Interview",
      "Are you sure? This action is irreversible and will remove the scheduled interview from your calendar and list.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) {
                Alert.alert("Session expired", "Please log in again.");
                return;
              }
              const res = await fetch(`${BASE_URL}/schedule/${scheduleId}/cancel`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error("Cancel failed");
              Alert.alert("Cancelled", "The interview has been cancelled.");
              // Reload the list
              loadNotifications();
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Failed to cancel interview. Please try again.");
            }
          },
        },
      ]
    );
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
          <Pressable style={styles.iconButton} onPress={() => router.push("/calendar")}>
            <Ionicons name="calendar" size={28} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.notificationsBox}>
        <Text style={styles.notificationsTitle}>Actions</Text>
        {loadingLogs ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : logs.length === 0 ? (
          <Text style={styles.empty}>No action required</Text>
        ) : (
          <View style={styles.notificationsList}>
            {logs.map((n) => {
              const isActionable = n.status === "interview" && n.interviewSubtype === "schedule_interview";
              const isScheduled = n.scheduling?.status === "scheduled";
              return (
                <View key={n._id} style={styles.notificationItem}>
                  <Text style={[styles.notificationType, isScheduled && styles.scheduledType]}>
                    {isScheduled
                      ? "Interview Scheduled"
                      : formatNotificationType(n.status, n.interviewSubtype)}
                  </Text>
                  <Text style={styles.notificationText}>
                    {n.company} — {n.role}
                  </Text>
                  {isScheduled && n.scheduling?.selectedSlot && (
                    <Text style={[styles.scheduledText]}>
                      Scheduled: {formatScheduledSlot(
                        n.scheduling.selectedSlot.start,
                        n.scheduling.selectedSlot.end,
                        n.scheduling.timezone
                      )}
                    </Text>
                  )}
                  {isActionable && (
                    <Pressable
                      style={[styles.button, { backgroundColor: "#007bff" }]}
                      onPress={() => initSchedule(n._id)}
                    >
                      <Text style={styles.buttonText}>
                        {isScheduled ? "Reschedule Interview" : "Schedule Interview"}
                      </Text>
                    </Pressable>
                  )}
                  {isScheduled && n.scheduling?.scheduleId && (
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => cancelInterview(n.scheduling!.scheduleId, n._id)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel Interview</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Pressable style={styles.bottomButton} onPress={() => router.push("/activity")}>
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
    paddingHorizontal: 16,
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
    backgroundColor: "#000",
    borderRadius: 14,
    borderColor: "#222",
    borderWidth: 1,
    justifyContent: "flex-start",
    alignItems: "stretch",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  notificationsList: {
    width: "100%",
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderColor: "#222",
    borderWidth: 1,
    backgroundColor: "#000",
    marginBottom: 10,
    alignSelf: "stretch",
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
    fontSize: 16,
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
    color: "#fff",
  },
  notificationType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007bff",
    marginBottom: 4,
  },
  scheduledType: {
    color: "#007bff", 
  },
  notificationText: {
    fontSize: 15,
    color: "#fff",
  },
  scheduledText: {
    fontSize: 13,
    marginTop: 6,
    color: "#10b981"
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
    color: "#007bff"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#dc2626", 
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
});