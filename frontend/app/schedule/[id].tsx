import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { DateTime } from "luxon";
import { useLocalSearchParams, router } from "expo-router";
import { getToken } from "../../utils/token";
import { sharedStyles } from "../styles/shared_styles";
import { FETCH_CALENDAR_AVAILABILITY_URL } from "../../constants/api";

type ApiErrorPayload = {
  error?: string;
  message?: string;
  reauthUrl?: string;
  connectUrl?: string;
};

const buildErrorMessage = (
  payload?: ApiErrorPayload,
  fallback?: string,
  status?: number
) => {
  const baseMessage = payload?.error || payload?.message || fallback || "Something went wrong.";
  const actionUrl = payload?.reauthUrl || payload?.connectUrl;

  if (status === 403 && actionUrl) {
    return `${baseMessage}\n\nReconnect Google here:\n${actionUrl}`;
  }

  if (actionUrl) {
    return `${baseMessage}\n\nMore info:\n${actionUrl}`;
  }

  return baseMessage;
};

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchAvailability = async (date: string) => {
    console.log("fetchAvailability called for date:", date);
    console.log("Using id:", id);
    if (!id) return;

    setLoading(true);
    setAvailability([]);
    setSelectedSlot(null);

    const start = DateTime.fromISO(date, { zone: timezone })
      .set({ hour: 9 })
      .toISO();
    const end = DateTime.fromISO(date, { zone: timezone })
      .set({ hour: 17 })
      .toISO();

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        router.replace("/(auth)/login");
        return;
      }

      const res = await fetch(
        `${FETCH_CALENDAR_AVAILABILITY_URL}/${id}/availability?start=${start}&end=${end}&timezone=${timezone}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const rawText = await res.text();
      let data: ApiErrorPayload & { availability?: any[] } = {};

      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { message: rawText };
        }
      }

      if (!res.ok) {
        const fallback =
          res.status === 403
            ? "Google Calendar access is unavailable. Please reconnect your Google account and try again."
            : `Failed to fetch availability (${res.status}).`;
        const message = buildErrorMessage(data, fallback, res.status);
        Alert.alert("Unable to load availability", message);
        throw new Error(message);
      }

      setAvailability(data.availability || []);
    } catch (err) {
      console.error("Availability fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmSlot = async () => {
    if (!selectedSlot || !id) return;

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        router.replace("/(auth)/login");
        return;
      }

      const res = await fetch(
        `${FETCH_CALENDAR_AVAILABILITY_URL}/${id}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: selectedSlot.start,
            end: selectedSlot.end,
            timezone,
          }),
        }
      );

      const rawText = await res.text();
      let data: ApiErrorPayload = {};

      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { message: rawText };
        }
      }

      if (!res.ok) {
        const fallback =
          res.status === 403
            ? "Google Calendar access is unavailable. Please reconnect your Google account and try again."
            : `Failed to confirm slot (${res.status}).`;
        const message = buildErrorMessage(data, fallback, res.status);
        Alert.alert("Unable to schedule interview", message);
        throw new Error(message);
      }

      Alert.alert("Success", "Interview scheduled successfully!");
      router.replace("/(tabs)/menu");
    } catch (err) {
      console.error("Confirm slot failed:", err);
    }
  };

  // Render each time slot
  const renderSlot = ({ item }: any) => {
    const isSelected = selectedSlot?.start === item.start;
    return (
      <Pressable
        style={[styles.slot, isSelected && styles.slotSelected]}
        onPress={() => setSelectedSlot(item)}
      >
        <Text style={styles.slotText}>
          {DateTime.fromISO(item.start).toFormat("hh:mm a")} –{" "}
          {DateTime.fromISO(item.end).toFormat("hh:mm a")}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Schedule Interview</Text>
        <Text style={styles.subheader}>Timezone: {timezone}</Text>

        <Calendar
          onDayPress={(day) => {
            setSelectedDate(day.dateString);
            fetchAvailability(day.dateString);
          }}
          markedDates={selectedDate ? { [selectedDate]: { selected: true } } : {}}
          style={{ marginBottom: 12 }}
          theme={{
              backgroundColor: "#000",
              calendarBackground: "#000",
              dayTextColor: "#fff",
              monthTextColor: "#fff",
              textDisabledColor: "#555",
              arrowColor: "#fff",
              todayTextColor: "#10b981",
              selectedDayBackgroundColor: "#2563eb",  // Add this
              selectedDayTextColor: "#ffffff",        // Add this
          }}
        />

        {loading && <ActivityIndicator size="large" style={{ marginBottom: 12 }} />}

        {availability.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Available Slots</Text>
            <FlatList
              data={availability}
              keyExtractor={(item) => item.start}
              renderItem={renderSlot}
              style={{ marginBottom: 12 }}
            />
          </>
        )}

        {selectedSlot && (
          <Pressable style={styles.confirmButton} onPress={confirmSlot}>
            <Text style={styles.buttonText}>
              Confirm {DateTime.fromISO(selectedSlot.start).toFormat("hh:mm a")} Slot
            </Text>
          </Pressable>
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
    paddingBottom: 80,
  },
  header: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 4,
  },
  subheader: {
    color: "#666",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#fff",
  },
  slot: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  slotSelected: {
    backgroundColor: "#eef6ff",
    borderColor: "#3b82f6",
  },
  slotText: {
    color: "#fff",
    fontSize: 15,
  },
  confirmButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: "#10b981",
    borderRadius: 12,
    alignItems: "center",
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