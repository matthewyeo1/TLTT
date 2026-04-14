import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { DateTime } from "luxon";
import { useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";
import { getToken } from "../../utils/token";
import { FETCH_CALENDAR_AVAILABILITY_URL } from "../../constants/api";

type ScheduledItem = {
  _id: string;
  emailId: string;
  company?: string;
  role?: string;
  timezone?: string;
  status: string;
  selectedSlot?: {
    start?: string;
    end?: string;
  };
  calendarEventId?: string;
  createdAt?: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  reauthUrl?: string;
  connectUrl?: string;
};

const buildErrorMessage = (payload?: ApiErrorPayload, fallback?: string) => {
  const baseMessage = payload?.error || payload?.message || fallback || "Something went wrong.";
  const actionUrl = payload?.reauthUrl || payload?.connectUrl;

  if (actionUrl) {
    return `${baseMessage}\n\nReconnect Google here:\n${actionUrl}`;
  }

  return baseMessage;
};

export default function CalendarScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduledItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    DateTime.local().toFormat("yyyy-MM-dd")
  );

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert("Session expired", "Please log in again.");
          router.replace("/(auth)/login");
          return;
        }

        const res = await fetch(FETCH_CALENDAR_AVAILABILITY_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const rawText = await res.text();
        let data: ApiErrorPayload & { schedules?: ScheduledItem[] } = {};

        if (rawText) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = { message: rawText };
          }
        }

        if (!res.ok) {
          const message = buildErrorMessage(
            data,
            `Failed to load scheduled interviews (${res.status}).`
          );
          Alert.alert("Unable to load calendar", message);
          throw new Error(message);
        }

        setSchedules(data.schedules || []);
      } catch (err) {
        console.error("Failed to load schedules:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSchedules();
  }, [router]);

  const markedDates = useMemo(() => {
    return schedules.reduce<Record<string, any>>((acc, schedule) => {
      const start = schedule.selectedSlot?.start;
      if (!start) return acc;

      const dayKey = DateTime.fromISO(start).toFormat("yyyy-MM-dd");
      acc[dayKey] = {
        marked: true,
        dotColor: "#10b981",
        selected: dayKey === selectedDate,
        selectedColor: dayKey === selectedDate ? "#2563eb" : undefined,
      };

      return acc;
    }, selectedDate ? {
      [selectedDate]: {
        selected: true,
        selectedColor: "#2563eb",
      },
    } : {});
  }, [schedules, selectedDate]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const start = schedule.selectedSlot?.start;
      if (!start) return false;
      return DateTime.fromISO(start).toFormat("yyyy-MM-dd") === selectedDate;
    });
  }, [schedules, selectedDate]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Your Calendar</Text>
        <Text style={styles.subheader}>
          View your scheduled interviews by date
        </Text>

        <Calendar
          markedDates={markedDates}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          style={styles.calendar}
          theme={{
            backgroundColor: "#000",
            calendarBackground: "#000",
            dayTextColor: "#fff",
            monthTextColor: "#fff",
            textDisabledColor: "#555",
            arrowColor: "#fff",
            todayTextColor: "#10b981",
          }}
        />

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} color="#fff" />
        ) : (
          <ScrollView style={styles.eventsContainer} contentContainerStyle={styles.eventsContent}>
            <Text style={styles.sectionTitle}>
              {filteredSchedules.length > 0
                ? `Scheduled for ${DateTime.fromISO(selectedDate).toFormat("DDD")}`
                : "No scheduled interviews for this date"}
            </Text>

            {filteredSchedules.map((schedule) => {
              const start = schedule.selectedSlot?.start;
              const end = schedule.selectedSlot?.end;

              if (!start || !end) return null;

              return (
                <View key={schedule._id} style={styles.eventCard}>
                  <Text style={styles.eventTitle}>
                    {schedule.company || "Interview"}
                    {schedule.role ? ` — ${schedule.role}` : ""}
                  </Text>
                  <Text style={styles.eventTime}>
                    {DateTime.fromISO(start).toFormat("hh:mm a")} –{" "}
                    {DateTime.fromISO(end).toFormat("hh:mm a")}
                  </Text>
                  <Text style={styles.eventMeta}>
                    Timezone: {schedule.timezone || "Unknown"}
                  </Text>
                  {schedule.calendarEventId ? (
                    <Text style={styles.eventMeta}>
                      Synced to Google Calendar
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Pressable
        style={styles.backButton}
        onPress={() => router.replace("/(tabs)/menu")}
      >
        <Text style={styles.buttonText}>Back to Menu</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...sharedStyles,
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  header: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 6,
  },
  subheader: {
    color: "#888",
    marginBottom: 12,
  },
  calendar: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  loader: {
    marginTop: 24,
  },
  eventsContainer: {
    flex: 1,
  },
  eventsContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: "#111",
    borderColor: "#222",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  eventTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  eventTime: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 6,
  },
  eventMeta: {
    color: "#999",
    fontSize: 13,
  },
  backButton: {
    position: "absolute",
    bottom: 45,
    left: 16,
    right: 16,
    paddingVertical: 14,
    backgroundColor: "#007bff",
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
