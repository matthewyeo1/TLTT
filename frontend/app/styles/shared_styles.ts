import { StyleSheet } from "react-native";

export const colors = {
  primary: "#007bff",
  darkBg: "#000",
  lightBg: "#fff",
  text: "#fff",
  muted: "gray",
  danger: "red",
  inputBorder: "#ccc",
};

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: colors.darkBg,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 24,
    color: colors.text,
  },
  input: {
    width: "100%",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    marginBottom: 12,
    color: colors.text,
  },
  button: {
    width: "100%",
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  buttonText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
    textAlign: "center",
  },
  link: {
    marginTop: 8,
    color: colors.primary,
    textAlign: "center",
    fontSize: 14,
  },
});

export default sharedStyles;