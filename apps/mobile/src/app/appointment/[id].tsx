import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppointmentDetails } from "@/components/AppointmentDetails";
import { AppointmentHeader } from "@/components/AppointmentHeader";
import { AppointmentSkeleton } from "@/components/AppointmentSkeleton";
import { AppointmentSummary } from "@/components/AppointmentSummary";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { BACK_LABEL, NOT_FOUND_TEXT, NOT_FOUND_TITLE, detailRows } from "@/lib/data/appointmentCard";
import { useAppointment } from "@/lib/data/hooks";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, space, typography } from "@/theme";

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default function AppointmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = stringParam(params.id) ?? "";
  const day = stringParam(params.day);
  const now = useNow();
  const online = useOnline();
  const card = useAppointment(id, day);
  const state = todayState({
    online,
    hasData: card.hasData,
    error: card.error,
    appointmentsError: card.appointmentsError,
  });
  const { appointment, timeZone } = card;
  const savedAt =
    timeZone !== undefined && card.dataUpdatedAt > 0 ? formatTime(new Date(card.dataUpdatedAt), timeZone) : null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppointmentHeader status={appointment?.status} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {card.notFound ? (
          <View style={styles.notFound}>
            <Text style={styles.notFoundTitle}>{NOT_FOUND_TITLE}</Text>
            <Text style={styles.notFoundText}>{NOT_FOUND_TEXT}</Text>
            <Button label={BACK_LABEL} variant="outline" onPress={goBack} />
          </View>
        ) : (
          <>
            {state.view === "loading" && <AppointmentSkeleton />}

            {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} />}

            {state.view === "error" && state.errorText !== null && (
              <View style={styles.errorBox}>
                <ErrorBanner message={state.errorText} />
                {state.canRetry && <Button label={RETRY_LABEL} onPress={card.refetch} />}
              </View>
            )}

            {state.view === "list" && appointment !== undefined && timeZone !== undefined && (
              <>
                {state.showOfflineBanner && <OfflineBanner savedAt={savedAt} />}
                {state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={card.refetch} />}
                <AppointmentSummary appointment={appointment} now={now} timeZone={timeZone} online={online} />
                <AppointmentDetails rows={detailRows(appointment)} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[12] },
  errorBox: { gap: space[12] },
  notFound: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: space[12] },
  notFoundTitle: { ...typography.titleS, color: colors.ink, textAlign: "center" },
  notFoundText: { ...typography.body, color: colors.muted, textAlign: "center" },
});
