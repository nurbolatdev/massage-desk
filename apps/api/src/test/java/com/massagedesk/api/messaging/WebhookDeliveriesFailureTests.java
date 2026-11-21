package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

class WebhookDeliveriesFailureTests {

    private static final Instant NOW = Instant.parse("2026-11-02T05:15:00Z");

    private final WebhookLogRepository logs = mock(WebhookLogRepository.class);
    private final InboundMessages inbound = mock(InboundMessages.class);
    private final WebhookDeliveries deliveries = new WebhookDeliveries(
            logs,
            JsonMapper.builder().build(),
            inbound,
            Clock.fixed(NOW, ZoneOffset.UTC));

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
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.FAILED);
        assertThat(saved.getError()).isEqualTo("java.lang.IllegalStateException");
        assertThat(saved.getProcessedAt()).isEqualTo(NOW);
        assertThat(saved.getPayload()).isNotNull();
        assertThat(saved.isSignatureValid()).isTrue();
    }

    @Test
    void successfulProcessingMarksDeliveryProcessed() {
        when(inbound.store(any())).thenReturn(1);

        deliveries.accept("{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8));

        ArgumentCaptor<WebhookLog> captor = ArgumentCaptor.forClass(WebhookLog.class);
        verify(logs, times(2)).save(captor.capture());
        WebhookLog saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WebhookStatus.PROCESSED);
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
