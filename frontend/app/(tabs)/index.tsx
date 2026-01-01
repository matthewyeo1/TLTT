import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { getToken } from '../../utils/token'; 
export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLogin = async () => {
      const token = await getToken();
      setIsLoggedIn(!!token); 
    };

    checkLogin();
  }, []);

  // Show nothing (or a loader) while checking
  if (isLoggedIn === null) {
    return null;
  }

  return isLoggedIn ? (
    <Redirect href="/(tabs)/menu" /> // logged-in home screen
  ) : (
    <Redirect href="/(auth)/login" /> // login screen
  );
}
