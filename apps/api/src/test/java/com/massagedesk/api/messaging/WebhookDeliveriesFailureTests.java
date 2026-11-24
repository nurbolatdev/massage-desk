package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(OutputCaptureExtension.class)
class WebhookDeliveriesFailureTests {

    private static final Instant NOW = Instant.parse("2026-11-02T05:15:00Z");

    private final WebhookLogRepository logs = mock(WebhookLogRepository.class);
    private final InboundMessages inbound = mock(InboundMessages.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final WebhookDeliveries deliveries = new WebhookDeliveries(
            logs,
            JsonMapper.builder().build(),
            inbound,
            Clock.fixed(NOW, ZoneOffset.UTC),
            events);

    @BeforeEach
    void stubSave() {
        when(logs.save(any(WebhookLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void processingFailureMarksDeliveryFailedWithExceptionClassNameAndKeepsPayload() {
        when(inbound.store(any())).thenThrow(new IllegalStateException("boom"));

        deliveries.accept("{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8));

        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        verify(logs, times(2)).save(captor.capture());
        verifyNoInteractions(events);
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.FAILED);
        assertThat(saved.getError()).isEqualTo("java.lang.IllegalStateException");
        assertThat(saved.getProcessedAt()).isEqualTo(NOW);
        assertThat(saved.getPayload()).isNotNull();
        assertThat(saved.isSignatureValid()).isTrue();
    }

    @Test
    void successfulProcessingMarksDeliveryProcessedAndPublishesEventsInOrderAfterSavingLog() {
        ClientMessageReceived first = new ClientMessageReceived(
                UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"),
                "wamid.ev-1",
                "Здравствуйте",
                null);
        ClientMessageReceived second = new ClientMessageReceived(
                UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"),
                "wamid.ev-2",
                "Записаться",
                "book");
        when(inbound.store(any())).thenReturn(new InboundMessages.Stored(List.of(first, second), 0));

        deliveries.accept("{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8));

        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        InOrder order = inOrder(logs, events);
        order.verify(logs, times(2)).save(captor.capture());
        order.verify(events).publishEvent(first);
        order.verify(events).publishEvent(second);
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.PROCESSED);
        assertThat(saved.getError()).isNull();
        assertThat(saved.getProcessedAt()).isEqualTo(NOW);
        assertThat(saved.getPayload()).isNotNull();
        assertThat(saved.isSignatureValid()).isTrue();
    }

    @Test
    void listenerFailureLogsOnlyExceptionClassNameAndContinuesToNextEvent(CapturedOutput output) {
        ClientMessageReceived first = new ClientMessageReceived(
                UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"),
                "wamid.ev-fail-1",
                "Секретный текст",
                null);
        ClientMessageReceived second = new ClientMessageReceived(
                UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"),
                "wamid.ev-fail-2",
                "Записаться",
                "book");
        when(inbound.store(any())).thenReturn(new InboundMessages.Stored(List.of(first, second), 0));
        doThrow(new IllegalStateException("+998901234567 Секретный текст")).when(events).publishEvent(first);

        deliveries.accept("{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8));

        verify(events).publishEvent(first);
        verify(events).publishEvent(second);
        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        verify(logs, times(2)).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
        assertThat(output.getOut())
                .contains("java.lang.IllegalStateException")
                .doesNotContain("+998901234567")
                .doesNotContain("Секретный текст");
    }

    @Test
    void duplicateDeliveryMarksLogDuplicateWithProcessedAt() {
        when(inbound.store(any())).thenReturn(new InboundMessages.Stored(List.of(), 2));

        deliveries.accept("{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8));

        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        verify(logs, times(2)).save(captor.capture());
        verifyNoInteractions(events);
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.DUPLICATE);
        assertThat(saved.getError()).isNull();
        assertThat(saved.getProcessedAt()).isEqualTo(NOW);
        assertThat(saved.getPayload()).isNotNull();
        assertThat(saved.isSignatureValid()).isTrue();
    }

    @Test
    void invalidJsonDoesNotCallInboundAndSavesFailedWithoutPayload() {
        deliveries.accept("not json".getBytes(StandardCharsets.UTF_8));

        verifyNoInteractions(inbound);
        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        verify(logs).save(captor.capture());
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.FAILED);
        assertThat(saved.getError()).isEqualTo("invalid_json");
        assertThat(saved.getPayload()).isNull();
        assertThat(saved.getProcessedAt()).isNull();
    }

    @Test
    void markProcessedOnRejectedRowThrowsIllegalStateException() {
        WebhookLog rejected = WebhookLog.rejected("missing_signature");

        assertThatThrownBy(() -> rejected.markProcessed(NOW))
                .isInstanceOf(IllegalStateException.class);
    }
}
