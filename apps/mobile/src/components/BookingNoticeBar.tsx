import { useEffect } from "react";
import { useIsFocused } from "expo-router";
import { BookingNoticeToast } from "@/components/BookingNoticeToast";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import {
  CANCEL_CONFIRM_TITLE,
  CANCEL_CONFIRM_YES,
  CANCEL_LABEL,
  cancelConfirmText,
} from "@/lib/data/appointmentCard";
import {
  bookingNoticeMsLeft,
  NOTICE_TITLE,
  clearBookingNotice,
  noticeText,
  renewBookingNotice,
  useBookingNotice,
} from "@/lib/data/bookingNotice";
import { useAppointmentAction } from "@/lib/data/hooks";
import { useDestructiveFlow } from "@/lib/data/useDestructiveFlow";

type Props = { timeZone: string | undefined; online: boolean };

/**
 * The «Записано» notice with «Отменить» and its cancel sheet. Shown only on the focused tab,
 * so a hidden tab never clears the notice under an open sheet.
 */
export function BookingNoticeBar({ timeZone, online }: Props) {
  const focused = useIsFocused();
  const notice = useBookingNotice();
  const mutation = useAppointmentAction();
  const flow = useDestructiveFlow(async (kind) => {
    if (notice === null) return;
    await mutation.mutateAsync({ id: notice.appointmentId, action: kind });
    clearBookingNotice();
  });
  const asking = flow.state.asking;

  // The notice hides by itself, but never while the cancel sheet is open.
  useEffect(() => {
    if (!focused || notice === null || asking !== null) return;
    const timer = setTimeout(clearBookingNotice, bookingNoticeMsLeft());
    return () => clearTimeout(timer);
  }, [focused, notice, asking]);

  if (!focused || notice === null || timeZone === undefined) return null;
  // An expired notice is not drawn while the effect clears it.
  if (asking === null && bookingNoticeMsLeft() === 0) return null;

  return (
    <>
      <BookingNoticeToast
        title={NOTICE_TITLE}
        text={noticeText(notice, timeZone)}
        actionLabel={CANCEL_LABEL}
        onAction={() => flow.ask("cancel")}
        actionDisabled={!online}
      />
      <ConfirmSheet
        visible={asking !== null}
        title={CANCEL_CONFIRM_TITLE}
        text={cancelConfirmText(notice.start, timeZone)}
        confirmLabel={CANCEL_CONFIRM_YES}
        confirmVariant="danger"
        confirmDisabled={!online}
        onConfirm={() => void flow.confirm()}
        onCancel={() => {
          flow.dismiss();
          renewBookingNotice();
        }}
        busy={flow.state.busy}
        error={flow.state.error ?? undefined}
      />
    </>
  );
}
