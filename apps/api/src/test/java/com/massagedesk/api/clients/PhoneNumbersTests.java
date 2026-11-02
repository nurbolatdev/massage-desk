package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

class PhoneNumbersTests {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "998901234567|+998901234567",
        "+998 (90) 123-45-67|+998901234567",
        "123456789|+123456789",
        "123456789012345|+123456789012345",
    })
    void normalizesValidNumbers(String input, String expected) {
        assertThat(PhoneNumbers.normalize(input)).contains(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"12345", "привет", "12345678", "1234567890123456", "٩٩٨٩٠١٢٣٤٥٦٧"})
    void refusesInvalidNumbers(String input) {
        assertThat(PhoneNumbers.normalize(input)).isEmpty();
    }

    @Test
    void nullIsEmpty() {
        assertThat(PhoneNumbers.normalize(null)).isEmpty();
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
