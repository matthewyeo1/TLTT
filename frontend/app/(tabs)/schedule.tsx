import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    FlatList,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { DateTime } from 'luxon';
import { getToken } from '../../utils/token';
import { sharedStyles } from '../styles/shared_styles';

type Props = {
    scheduleId: string;
};

export default function SchedulingPicker({ scheduleId }: Props) {
    const [token, setToken] = useState<string | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [dateLoading, setDateLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [availability, setAvailability] = useState<any[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [slotDuration, setSlotDuration] = useState<number>(30);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Fetch token
    useEffect(() => {
        const fetchToken = async () => {
            const t = await getToken();
            if (!t) return;
            setToken(t);
            setPageLoading(false);
        };
        fetchToken();
    }, []);

    const fetchAvailability = async (date: string) => {
        if (!token) return;

        setDateLoading(true);
        setAvailability([]);
        setSelectedSlot(null);

        // 24/7 availability for the selected date in user's timezone
        const start = DateTime.fromISO(date, { zone: timezone })
            .set({ hour: 0, minute: 0 })  
            .toISO();
        const end = DateTime.fromISO(date, { zone: timezone })
            .plus({ days: 1 })
            .set({ hour: 0, minute: 0 })  
            .toISO();

        try {
            const res = await fetch(
                `/schedule/${scheduleId}/availability?start=${start}&end=${end}&timezone=${timezone}&duration=${slotDuration}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`Failed to fetch availability: ${res.status}`);
            const data = await res.json();
            setAvailability(data.availability || []);
        } catch (err) {
            console.error('Availability fetch failed:', err);
        } finally {
            setDateLoading(false);
        }
    };

    const renderSlot = ({ item }: any) => {
        const start = DateTime.fromISO(item.start).toFormat('hh:mm a');
        const end = DateTime.fromISO(item.end).toFormat('hh:mm a');
        const isSelected = selectedSlot?.start === item.start;

        return (
            <Pressable
                onPress={() => setSelectedSlot(item)}
                style={[styles.slot, isSelected && styles.slotSelected]}
            >
                <Text style={styles.slotText}>{start} – {end}</Text>
            </Pressable>
        );
    };

    const confirmSlot = async () => {
        if (!selectedSlot || !token) return;
        try {
            const res = await fetch(`/schedule/${scheduleId}/confirm`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    start: selectedSlot.start,
                    end: selectedSlot.end,
                    timezone,
                }),
            });
            if (!res.ok) throw new Error(`Failed to confirm slot: ${res.status}`);
            setConfirmed(true);
        } catch (err) {
            console.error('Slot confirmation failed:', err);
        }
    };

    if (pageLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (confirmed) {
        return (
            <View style={styles.container}>
                <Text style={styles.confirmedText}>Interview Scheduled Successfully!</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Calendar
                onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                    fetchAvailability(day.dateString);
                }}
                markedDates={selectedDate ? { 
                    [selectedDate]: { 
                        selected: true, 
                        selectedColor: "#2563eb"
                    } 
                } : {}}
                style={{ marginBottom: 12 }}
                theme={{
                    backgroundColor: "#000",
                    calendarBackground: "#000",
                    dayTextColor: "#fff",
                    monthTextColor: "#fff",
                    textDisabledColor: "#555",
                    arrowColor: "#fff",
                    todayTextColor: "#10b981",
                    selectedDayBackgroundColor: "#2563eb", 
                    selectedDayTextColor: "#ffffff",        
                }}
            />

            {!dateLoading && availability.length > 0 && (
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

                    <Pressable style={styles.button} onPress={confirmSlot}>
                        <Text style={styles.buttonText}>Confirm & Send</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    ...sharedStyles,
    container: { 
        marginVertical: 8 
    },
    sectionTitle: { 
        fontSize: 16, 
        fontWeight: '500', 
        marginVertical: 12 
    },
    slot: { 
        padding: 14, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        marginBottom: 8 
    },
    slotSelected: { 
        backgroundColor: '#eef6ff', 
        borderColor: '#3b82f6' 
    },
    slotText: { 
        color: '#fff', 
        fontSize: 15 
    },
    confirmation: { 
        marginTop: 16, 
        padding: 12, 
        backgroundColor: '#f0fdf4', 
        borderRadius: 8 
    },
    confirmText: { 
        fontSize: 14, 
        fontWeight: '500', 
        marginBottom: 8 
    },
    button: { 
        backgroundColor: '#3b82f6', 
        padding: 12, 
        borderRadius: 8, 
        alignItems: 'center' 
    },
    buttonText: { 
        color: '#fff', 
        fontWeight: '600' 
    },
    confirmedText: { 
        fontSize: 16, 
        fontWeight: '600', 
        color: '#10b981' 
    },
});
