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
import { FETCH_USER_INFO_URL } from '../../constants/api';

export default function CalendarScreen() {
    const router = useRouter();
    return (
        <View style={styles.container}>
            
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
    header: { 
        color: '#fff', 
        fontSize: 24, 
        fontWeight: '600', 
        marginBottom: 8 
    },
    subheader: { 
        color: '#666', 
        marginBottom: 12 
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
        fontWeight: '500' 
    },
});

