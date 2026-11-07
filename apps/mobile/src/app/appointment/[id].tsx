import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppointmentActionBar } from "@/components/AppointmentActionBar";
import { AppointmentDetails } from "@/components/AppointmentDetails";
import { AppointmentHeader } from "@/components/AppointmentHeader";
import { AppointmentSkeleton } from "@/components/AppointmentSkeleton";
import { AppointmentSummary } from "@/components/AppointmentSummary";
import { Button } from "@/components/Button";
import { ClientNoteCard, type NoteState } from "@/components/ClientNoteCard";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { ErrorBanner } from "@/components/ErrorBanner";
import { NoteSheet } from "@/components/NoteSheet";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import {
  BACK_LABEL,
  CANCEL_CONFIRM_TITLE,
  CANCEL_CONFIRM_YES,
  NOT_FOUND_TEXT,
  NOT_FOUND_TITLE,
  NO_SHOW_CONFIRM_TEXT,
  NO_SHOW_CONFIRM_TITLE,
  NO_SHOW_CONFIRM_YES,
  cancelConfirmText,
  cardActions,
  detailRows,
} from "@/lib/data/appointmentCard";
import { NOTE_INLINE_PREFIX, NOTE_SAVE_FAILED } from "@/lib/data/clientNote";
import { useAppointment, useAppointmentAction, useClient, useUpdateClientNotes } from "@/lib/data/hooks";
import { useDestructiveFlow } from "@/lib/data/useDestructiveFlow";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, space, typography } from "@/theme";

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
  const client = useClient(appointment?.clientId);
  const saveNote = useUpdateClientNotes(appointment?.clientId ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const note = client.data?.notes ?? null;
  const noteState: NoteState =
    client.data !== undefined ? "ready" : client.isError ? "error" : !online ? "offline" : "loading";
  const mutation = useAppointmentAction();
  const flow = useDestructiveFlow((kind) => mutation.mutateAsync({ id, action: kind }));
  const actions = appointment !== undefined ? cardActions(appointment, now) : { cancel: false, noShow: false };
  const asking = flow.state.asking;
  const closeNote = () => {
    setEditingNote(false);
    saveNote.reset();
  };
  const showNote = appointment?.status === "confirmed" || appointment?.status === "done";
  const inlineNote = appointment?.status === "no_show" ? (note?.trim() ?? "") : "";
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
                {showNote && (
                  <ClientNoteCard
                    note={note}
                    state={noteState}
                    online={online}
                    onEdit={() => setEditingNote(true)}
                    onRetry={() => void client.refetch()}
                  />
                )}
                {inlineNote !== "" && (
                  <Text style={styles.inlineNote}>
                    <Text style={styles.inlineNotePrefix}>{NOTE_INLINE_PREFIX} </Text>
                    {inlineNote}
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      {actions.cancel && state.view === "list" && timeZone !== undefined && (
        <AppointmentActionBar
          showNoShow={actions.noShow}
          disabled={!online}
          onNoShow={() => flow.ask("noShow")}
          onCancel={() => flow.ask("cancel")}
        />
      )}
      {appointment !== undefined && timeZone !== undefined && (
        <ConfirmSheet
          visible={asking !== null}
          title={asking === "noShow" ? NO_SHOW_CONFIRM_TITLE : CANCEL_CONFIRM_TITLE}
          text={asking === "noShow" ? NO_SHOW_CONFIRM_TEXT : cancelConfirmText(appointment.start, timeZone)}
          confirmLabel={asking === "noShow" ? NO_SHOW_CONFIRM_YES : CANCEL_CONFIRM_YES}
          confirmVariant={asking === "noShow" ? "primary" : "danger"}
          confirmDisabled={!online}
          onConfirm={() => void flow.confirm()}
          onCancel={flow.dismiss}
          busy={flow.state.busy}
          error={flow.state.error ?? undefined}
        />
      )}
      {appointment !== undefined && (
        <NoteSheet
          visible={editingNote}
          clientName={appointment.clientName}
          initial={note ?? ""}
          busy={saveNote.isPending}
          saveDisabled={!online}
          error={saveNote.isError ? NOTE_SAVE_FAILED : undefined}
          onSave={(text) => saveNote.mutate(text.trim(), { onSuccess: closeNote })}
          onClose={closeNote}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[12] },
  inlineNote: {
    ...typography.body,
    color: colors.ink,
    backgroundColor: colors.note,
    borderRadius: radii[16],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
  },
  inlineNotePrefix: { fontWeight: "700" },
  errorBox: { gap: space[12] },
  notFound: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: space[12] },
  notFoundTitle: { ...typography.titleS, color: colors.ink, textAlign: "center" },
  notFoundText: { ...typography.body, color: colors.muted, textAlign: "center" },
});
