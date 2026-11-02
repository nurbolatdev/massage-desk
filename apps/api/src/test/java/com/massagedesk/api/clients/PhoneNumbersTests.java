package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

class PhoneNumbersTests {

    private static final Path FIXTURE = Path.of("../../packages/shared/fixtures/phones.json");

    static Stream<Arguments> fixtureCases() throws IOException {
        assertThat(FIXTURE).as("shared phone fixture at %s", FIXTURE.toAbsolutePath()).exists();
        JsonNode cases = JsonMapper.builder().build().readTree(Files.readString(FIXTURE)).get("cases");
        List<Arguments> result = new ArrayList<>();
        for (JsonNode c : cases) {
            JsonNode expectedByRegion = c.get("expected");
            assertThat(expectedByRegion.propertyNames()).containsExactlyInAnyOrder("UZ", "KZ");
            for (String region : List.of("UZ", "KZ")) {
                JsonNode expected = expectedByRegion.get(region);
                result.add(Arguments.of(c.get("input").asString(), region, expected.isNull() ? null : expected.asString()));
            }
        }
        return result.stream();
    }

    @ParameterizedTest(name = "[{index}] \"{0}\" in {1} -> {2}")
    @MethodSource("fixtureCases")
    void matchesSharedFixture(String input, String region, String expected) {
        Optional<String> actual = PhoneNumbers.normalize(input, region);
        if (expected == null) {
            assertThat(actual).isEmpty();
        } else {
            assertThat(actual).contains(expected);
        }
    }

    @Test
    void nullIsEmpty() {
        assertThat(PhoneNumbers.normalize(null, "UZ")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"+998901234567", "+123456789", "+123456789012345"})
    void acceptsE164(String phone) {
        assertThat(PhoneNumbers.isE164(phone)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"998901234567", "+12345678", "+1234567890123456", "+99890123456a", ""})
    void refusesNonE164(String phone) {
        assertThat(PhoneNumbers.isE164(phone)).isFalse();
    }

    @Test
    void nullIsNotE164() {
        assertThat(PhoneNumbers.isE164(null)).isFalse();
    }

    @Test
    void clientRefusesNonE164Phone() {
        assertThatThrownBy(() -> new Client("998901234567", "No plus"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("phone must be E.164");
    }
}
