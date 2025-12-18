import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";

type Offer = {
  id: string;
  sender: string;
  subject: string;
  date: string;
  status: "pending" | "accepted" | "rejected";
};

const SAMPLE_OFFERS: Offer[] = [
  {
    id: "1",
    sender: "recruiter@companyA.com",
    subject: "Internship offer - Software Engineer Intern",
    date: "2025-06-01",
    status: "pending",
  },
  {
    id: "2",
    sender: "hr@companyB.com",
    subject: "Internship decision - UX Intern",
    date: "2025-05-18",
    status: "rejected",
  },
  {
    id: "3",
    sender: "talent@companyC.com",
    subject: "Offer: Backend Intern",
    date: "2025-05-25",
    status: "accepted",
  },
];

const STATUS_ORDER: (Offer["status"] | "all")[] = ["all", "pending", "accepted", "rejected"];

export default function ActivityScreen() {
  const router = useRouter();
  const [offers] = useState<Offer[]>(SAMPLE_OFFERS);
  const [filter, setFilter] = useState<Offer["status"] | "all">("all");

  const filtered = filter === "all" ? offers : offers.filter((o) => o.status === filter);

  const statusColor = (s: Offer["status"]) =>
    s === "accepted" ? "#28a745" : s === "rejected" ? "#dc3545" : "#ffc107";

  const renderItem = ({ item }: { item: Offer }) => (
    <Pressable
      style={styles.card}

      /*
      onPress={() => {
        // TODO: navigate to details / open email view
        router.push(`/(tabs)/activity/${item.id}`);
      }}
      */
    >
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.subject} numberOfLines={2}>
            {item.subject}
          </Text>
          <Text style={styles.sender}>{item.sender}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Internship-related messages and offers</Text>

      <View style={styles.filterRow}>
        {STATUS_ORDER.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterButton,
              filter === s && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(s as any)}
          >
            <Text
              style={[
                styles.filterText,
                filter === s && styles.filterTextActive,
              ]}
            >
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No messages</Text>}
      />
      {/* Back to Menu button */}
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
  return dt.toLocaleDateString();
}

const styles = StyleSheet.create({
  ...sharedStyles,
  subtitle: {
    color: "gray",
    marginBottom: 12,
    marginTop: 50,
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
  },
  filterButtonActive: {
    backgroundColor: "#007bff",
  },
  filterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  subject: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 6,
  },
  sender: {
    color: "gray",
    fontSize: 13,
  },
  meta: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  date: {
    color: "gray",
    fontSize: 12,
    marginBottom: 6,
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
});