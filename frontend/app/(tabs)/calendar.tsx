import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    FlatList,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { DateTime } from 'luxon';
import { Calendar } from 'react-native-calendars';
import { getToken } from '../../utils/token';
import { useRouter } from 'expo-router';
import { sharedStyles } from '../styles/shared_styles';
import { FETCH_USER_INFO_URL, FETCH_CALENDAR_EVENTS_URL } from '../../constants/api';

export default function CalendarScreen() {
    const router = useRouter();

    const [userName, setUserName] = useState<string>('User');
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [availability, setAvailability] = useState<any[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Fetch token and user info
    useEffect(() => {
        const fetchUser = async () => {
            const t = await getToken();
            if (!t) {
                router.replace('/(auth)/login');
                return;
            }
            setToken(t);

            try {
                const res = await fetch(`${FETCH_USER_INFO_URL}`, {
                    headers: { Authorization: `Bearer ${t}` },
                });

                if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`);

                const data = await res.json();
                setUserName(data.name || data.email || 'User');
            } catch (err) {
                console.error('Error fetching user info:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    const fetchAvailability = async (date: string) => {
        if (!token) return;

        setLoading(true);
        setAvailability([]);
        setSelectedSlot(null);

        const start = DateTime.fromISO(date, { zone: timezone }).set({ hour: 9 }).toISO();
        const end = DateTime.fromISO(date, { zone: timezone }).set({ hour: 17 }).toISO();

        try {
            const res = await fetch(
                `${FETCH_CALENDAR_EVENTS_URL}?start=${start}&end=${end}&timezone=${timezone}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) throw new Error(`Failed to fetch availability: ${res.status}`);

            const data = await res.json();
            setAvailability(data.availability || []);
        } catch (err) {
            console.error('Availability fetch failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderSlot = ({ item }: any) => {
        const start = DateTime.fromISO(item.start).toFormat('hh:mm a');
        const end = DateTime.fromISO(item.end).toFormat('hh:mm a');
        const isSelected = selectedSlot?.start === item.start;

        return (
            <Pressable
                onPress={() => setSelectedSlot(item)}
                style={[
                    styles.slot,
                    isSelected && styles.slotSelected,
                ]}
            >
                <Text style={styles.slotText}>{start} – {end}</Text>
            </Pressable>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Schedule Interview</Text>
            <Text style={styles.subheader}>Hello, {userName}</Text>
            <Text style={styles.subheader}>Timezone: {timezone}</Text>

            <Calendar
                onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                    fetchAvailability(day.dateString);
                }}
                markedDates={selectedDate ? { [selectedDate]: { selected: true } } : {}}
            />

            {!loading && availability.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Available Times</Text>
                    <FlatList
                        data={availability}
                        keyExtractor={(item) => item.start}
                        renderItem={renderSlot}
                    />
                </>
            )}

            {selectedSlot && (
                <View style={styles.confirmation}>
                    <Text style={styles.confirmText}>Selected:</Text>
                    <Text style={styles.confirmText}>
                        {DateTime.fromISO(selectedSlot.start).toLocaleString(DateTime.DATETIME_MED)}
                    </Text>
                </View>
            )}

            <Pressable
                style={[styles.button, { marginTop: 145 }]}
                onPress={() => router.replace("/(tabs)/menu")}
            >
                <Text style={styles.buttonText}>Back to Menu</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    ...sharedStyles,
    header: { color: '#fff', fontSize: 24, fontWeight: '600', marginBottom: 8 },
    subheader: { color: '#666', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '500', marginVertical: 12 },
    slot: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 8 },
    slotSelected: { backgroundColor: '#eef6ff', borderColor: '#3b82f6' },
    slotText: { fontSize: 15 },
    confirmation: { marginTop: 16, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8 },
    confirmText: { fontSize: 14, fontWeight: '500' },
});

