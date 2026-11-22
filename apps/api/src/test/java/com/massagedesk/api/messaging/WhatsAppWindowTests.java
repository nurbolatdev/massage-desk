package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.WhatsAppSendException.Reason;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class WhatsAppWindowTests {

    private static final Instant T = Instant.parse("2026-11-01T05:15:00Z");
    private static final Instant ALMOST_24H = T.plus(Duration.ofHours(23).plusMinutes(59).plusSeconds(59));
    private static final Instant EXACTLY_24H = T.plus(Duration.ofHours(24));

    private static final Text TEXT = new Text("Запись подтверждена");
    private static final Buttons BUTTONS = new Buttons(
            "Выберите действие",
            List.of(new Button("confirm", "Подтвердить")));
    private static final ListMenu LIST_MENU = new ListMenu(
            "Выберите услугу",
            "Услуги",
            List.of(new Row("classic-60", "Классический массаж", "60 минут")));
    private static final Template TEMPLATE = new Template("booking_reminder", "ru", List.of("14:00"));

    @Test
    void checks24HourBoundaryOnIsOpen() {
        assertThat(WhatsAppWindow.LENGTH).isEqualTo(Duration.ofHours(24));
        assertThat(WhatsAppWindow.isOpen(T, T)).isTrue();
        assertThat(WhatsAppWindow.isOpen(T, ALMOST_24H)).isTrue();
        assertThat(WhatsAppWindow.isOpen(T, EXACTLY_24H)).isFalse();
        assertThat(WhatsAppWindow.isOpen(T, EXACTLY_24H.plusNanos(1))).isFalse();
        assertThat(WhatsAppWindow.isOpen(null, T)).isFalse();
        assertThat(WhatsAppWindow.isOpen(T.plus(Duration.ofHours(1)), T)).isTrue();
    }

    @Test
    void allowsTemplatesAnytimeAndOtherKindsOnlyInsideWindow() {
        assertThat(WhatsAppWindow.allows(TEMPLATE, null, T)).isTrue();
        assertThat(WhatsAppWindow.allows(TEMPLATE, T.minus(Duration.ofHours(48)), T)).isTrue();

        for (OutboundMessage nonTemplate : List.of(TEXT, BUTTONS, LIST_MENU)) {
            assertThat(WhatsAppWindow.allows(nonTemplate, null, T)).isFalse();
            assertThat(WhatsAppWindow.allows(nonTemplate, T, EXACTLY_24H)).isFalse();
            assertThat(WhatsAppWindow.allows(nonTemplate, T, ALMOST_24H)).isTrue();
        }
    }

    @Test
    void detectsMetaOutsideWindowErrorCode131047() {
        assertThat(WhatsAppWindow.closedByMeta(new WhatsAppSendException(Reason.REJECTED, 400, 131047)))
                .isTrue();
        assertThat(WhatsAppWindow.closedByMeta(new WhatsAppSendException(Reason.REJECTED, 400, 131026)))
                .isFalse();
        assertThat(WhatsAppWindow.closedByMeta(new WhatsAppSendException(Reason.REJECTED, 400, null)))
                .isFalse();
        assertThat(WhatsAppWindow.closedByMeta(new WhatsAppSendException(Reason.UNAVAILABLE, 503, null)))
                .isFalse();
    }

    @Test
    void rejectsNullArguments() {
        assertThatThrownBy(() -> WhatsAppWindow.isOpen(T, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> WhatsAppWindow.allows(null, T, T))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> WhatsAppWindow.allows(TEMPLATE, T, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> WhatsAppWindow.closedByMeta(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void outsideWindowExceptionKeepsFixedMessageAndCause() {
        OutsideWindowException direct = new OutsideWindowException();
        assertThat(direct.getCause()).isNull();
        assertThat(direct.getMessage())
                .isEqualTo("Outside the 24-hour window: only template messages can be sent");

        WhatsAppSendException cause = new WhatsAppSendException(Reason.REJECTED, 400, 131047);
        OutsideWindowException wrapped = new OutsideWindowException(cause);
        assertThat(wrapped.getCause()).isSameAs(cause);
        assertThat(wrapped.getMessage())
                .isEqualTo("Outside the 24-hour window: only template messages can be sent")
                .doesNotContain("400", "131047");
    }
}
