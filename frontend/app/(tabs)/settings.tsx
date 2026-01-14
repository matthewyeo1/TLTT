import React, { useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Switch,
} from "react-native";
import { router } from "expo-router";
import { sharedStyles } from "../styles/shared_styles";

export default function SettingsScreen() {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);

    type RowProps = {
        label: string;
        value?: string;
        onPress?: () => void;
        right?: React.ReactNode;
    };

    const Row: React.FC<RowProps> = ({ label, value, onPress, right }) => (
        <Pressable style={styles.row} onPress={onPress}>
            <Text style={styles.rowLabel}>{label}</Text>
            {right ?? <Text style={styles.rowValue}>{value ?? ""}</Text>}
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.section}>Account</Text>
            <View style={styles.card}>
                <Row
                    label="Profile"
                    value="View"
                    onPress={() => router.push("/profile")}
                />
                <Row
                    label="Connected Gmail"
                    value="Manage"
                    onPress={() => router.push("/connect-gmail")}
                />
            </View>
            <Text style={styles.section}>Notifications</Text>
            <View style={styles.card}>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Push Notifications</Text>
                    <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        style={styles.switch}
                    />
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Email Notifications</Text>
                    <Switch
                        value={emailEnabled}
                        onValueChange={setEmailEnabled}
                        style={styles.switch}
                    />
                </View>
            </View>
            <Text style={styles.section}>App</Text>
            <View style={styles.card}>
                <Row
                    label="Privacy Policy"
                    value="View"
                    onPress={() => router.push("/privacy")}
                />
                <Row
                    label="Terms of Service"
                    value="View"
                    onPress={() => router.push("/terms")}
                />
                <Row
                    label="App Version"
                    value="1.0.0"
                />
            </View>
            <Pressable
                style={[styles.button, styles.backButton]}
                onPress={() => router.replace("/(tabs)/menu")}
            >
                <Text style={styles.buttonText}>Back to Menu</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    ...sharedStyles,
    section: {
        color: "gray",
        marginBottom: 8,
        marginTop: 100,
        marginLeft: 6,
        fontSize: 13,
        textTransform: "uppercase",
    },
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: "#0f0f0f",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#222",
        overflow: "hidden",
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    row: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#1f1f1f",
    },
    rowLabel: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "500",
    },
    rowValue: {
        color: "gray",
        fontSize: 14,
        marginLeft: "auto",
    },
    backButton: {
        alignSelf: "center",
        width: "90%",
        marginTop: 36,
    },
    switch: {
        marginLeft: "auto",
    },
});
