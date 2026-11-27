package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class PushMessageTests {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t", "\n"})
    void rejectsBlankOrNullTitle(String badTitle) {
        assertThatThrownBy(() -> new PushMessage(badTitle, "Body", Map.of(), "appointments"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("title must not be blank");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t", "\n"})
    void rejectsBlankOrNullBody(String badBody) {
        assertThatThrownBy(() -> new PushMessage("Title", badBody, Map.of(), "appointments"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("body must not be blank");
    }

    @Test
    void nullDataBecomesEmptyMapAndNullChannelIdIsAllowed() {
        PushMessage message = new PushMessage("Новая запись", "14:00 · Классический массаж", null, null);

        assertThat(message.title()).isEqualTo("Новая запись");
        assertThat(message.body()).isEqualTo("14:00 · Классический массаж");
        assertThat(message.data()).isEmpty();
        assertThat(message.channelId()).isNull();
    }

    @Test
    void copiesDataDefensively() {
        Map<String, String> source = new HashMap<>();
        source.put("appointmentId", "a-1");

        PushMessage message = new PushMessage("Новая запись", "14:00", source, "appointments");
        source.put("appointmentId", "mutated");
        source.put("extra", "value");

        assertThat(message.data()).containsExactlyEntriesOf(Map.of("appointmentId", "a-1"));
        assertThatThrownBy(() -> message.data().put("k", "v"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void rejectsNullKeyOrValueInData() {
        Map<String, String> nullKey = new HashMap<>();
        nullKey.put(null, "v");
        assertThatThrownBy(() -> new PushMessage("Title", "Body", nullKey, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("data must not contain null keys or values");

        Map<String, String> nullValue = new HashMap<>();
        nullValue.put("k", null);
        assertThatThrownBy(() -> new PushMessage("Title", "Body", nullValue, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("data must not contain null keys or values");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "   ", "\t", "\n"})
    void rejectsBlankChannelId(String blankChannel) {
        assertThatThrownBy(() -> new PushMessage("Title", "Body", Map.of(), blankChannel))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("channelId must not be blank");
    }
}
