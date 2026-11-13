import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppointmentHeader } from "@/components/AppointmentHeader";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { PRESSED_OPACITY } from "@/components/pressed";
import { TimeOffPeriodRow } from "@/components/TimeOffPeriodRow";
import { LOADING_LABEL } from "@/lib/data/appointmentCard";
import { useUpcomingTimeOff } from "@/lib/data/hooks";
import { TIME_OFF_SETTINGS_TITLE } from "@/lib/data/timeOffForm";
import {
  ADD_DATES_LABEL,
  TIME_OFF_EMPTY_TEXT,
  TIME_OFF_LIST_OFFLINE_EMPTY_TEXT,
  TIME_OFF_LIST_OFFLINE_TEXT,
  TIME_OFF_LIST_TITLE,
} from "@/lib/data/timeOffList";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, size, space, typography } from "@/theme";

// from the SettingsTimeOff mockup
const ADD_ICON_SIZE = 20;

export default function TimeOffListScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const { timeZone, periods, dataUpdatedAt, error, refreshError, refetch } = useUpcomingTimeOff(now);
  const state = todayState({ online, hasData: periods !== undefined, error, appointmentsError: refreshError });
  const savedAt = timeZone !== undefined && dataUpdatedAt > 0 ? formatTime(new Date(dataUpdatedAt), timeZone) : null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppointmentHeader title={TIME_OFF_SETTINGS_TITLE} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {state.view === "offlineEmpty" && (
          <OfflineBanner savedAt={null} text={TIME_OFF_LIST_OFFLINE_EMPTY_TEXT} />
        )}
        {state.view === "error" && state.errorText !== null && (
          <View style={styles.errorBox}>
            <ErrorBanner message={state.errorText} />
            {state.canRetry && <Button label={RETRY_LABEL} onPress={refetch} />}
          </View>
        )}
        {state.view === "list" && state.showOfflineBanner && (
          <OfflineBanner savedAt={savedAt} text={TIME_OFF_LIST_OFFLINE_TEXT} />
        )}
        {state.view === "list" && state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={refetch} />}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {TIME_OFF_LIST_TITLE}
          </Text>
          {state.view === "loading" && (
            <View accessible accessibilityRole="progressbar" accessibilityLabel={LOADING_LABEL} style={styles.skeleton}>
              <View style={styles.skeletonBlock} />
              <View style={styles.skeletonBlock} />
            </View>
          )}
          {state.view === "list" && periods?.length === 0 && <Text style={styles.empty}>{TIME_OFF_EMPTY_TEXT}</Text>}
          {state.view === "list" && periods?.map((view) => <TimeOffPeriodRow key={view.id} view={view} />)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ADD_DATES_LABEL}
            onPress={() => router.push("/time-off/new")}
            style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
          >
            <Feather name="plus" size={ADD_ICON_SIZE} color={colors.primaryStrong} accessible={false} />
            <Text style={styles.addText}>{ADD_DATES_LABEL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[12] },
  errorBox: { gap: space[12] },
  section: { gap: space[8] },
  sectionTitle: { ...typography.body, fontWeight: "700", color: colors.ink },
  empty: { ...typography.secondary, color: colors.muted },
  skeleton: { gap: space[8] },
  skeletonBlock: {
    minHeight: size.iconButton + 2 * space[14],
    borderRadius: radii[18],
    backgroundColor: colors.segmentBg,
  },
  add: {
    minHeight: size.buttonSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[8],
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    borderRadius: radii[16],
  },
  addPressed: { opacity: PRESSED_OPACITY },
  addText: { ...typography.body, fontWeight: "700", color: colors.primaryStrong },
});
