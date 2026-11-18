package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class PhonePropertiesTests {

    @Test
    void acceptsSupportedRegion() {
        assertThat(new PhoneProperties("UZ").defaultRegion()).isEqualTo("UZ");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"XX", "uz", "UZB"})
    void refusesOtherValues(String region) {
        assertThatThrownBy(() -> new PhoneProperties(region))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("app.phone.default-region must be a supported region code, e.g. UZ");
    }

    @Test
    void contextFailsToStartWithUnknownRegion() {
        new ApplicationContextRunner()
            .withUserConfiguration(ClientsConfig.class)
            .withPropertyValues("app.phone.default-region=XX")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void contextBindsConfiguredRegion() {
        new ApplicationContextRunner()
            .withUserConfiguration(ClientsConfig.class)
            .withPropertyValues("app.phone.default-region=KZ")
            .run(context -> assertThat(context.getBean(PhoneProperties.class).defaultRegion()).isEqualTo("KZ"));
    }
}
