import { Redirect } from "expo-router";

export default function Index() {
  const isLoggedIn = false; // TODO: check SecureStore

  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
