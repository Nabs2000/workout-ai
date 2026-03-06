import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useUserStore } from '../stores/userStore';
import { COLORS } from '../constants';

/**
 * Entry point: decides whether to show onboarding or the main app.
 */
export default function IndexScreen() {
  const router = useRouter();
  const { isLoading, isOnboarded } = useUserStore();

  useEffect(() => {
    if (isLoading) return;
    if (isOnboarded) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded]);

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.logo}>FitCoach AI</Text>
      <ActivityIndicator animating color={COLORS.primary} size="large" style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
