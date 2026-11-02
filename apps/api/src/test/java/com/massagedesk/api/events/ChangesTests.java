package com.massagedesk.api.events;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ChangesTests {

    @Test
    void noChangeIsEmpty() {
        Changes changes = new Changes()
                .value("name", "a", "a")
                .value("price", new BigDecimal("100"), new BigDecimal("100.00"))
                .personal("notes", null, null);

        assertThat(changes.isEmpty()).isTrue();
        assertThat(changes.payload()).isEqualTo(Map.of("changed", List.of(), "from", Map.of(), "to", Map.of()));
    }

    @Test
    void valueChangeKeepsBothSides() {
        Changes changes = new Changes()
                .value("duration_min", 60, 90)
                .value("price", new BigDecimal("100.00"), new BigDecimal("150.50"))
                .value("active", true, false);

        assertThat(changes.isEmpty()).isFalse();
        assertThat(changes.payload()).isEqualTo(Map.of(
                "changed", List.of("duration_min", "price", "active"),
                "from", Map.of("duration_min", 60, "price", "100.00", "active", true),
                "to", Map.of("duration_min", 90, "price", "150.50", "active", false)));
    }

    @Test
    void personalChangeIsOnlyNamed() {
        Changes changes = new Changes().personal("name", "Aziza", "Bella").personal("notes", null, "text");

        assertThat(changes.payload()).isEqualTo(Map.of(
                "changed", List.of("name", "notes"), "from", Map.of(), "to", Map.of()));
    }

    @Test
    void nullSidesAreAllowed() {
        Changes changes = new Changes().value("sort_order", null, 3);

        assertThat(changes.payload().get("from")).isEqualTo(java.util.Collections.singletonMap("sort_order", null));
    }

    @Test
    void orderOfAdditionIsKept() {
        Changes changes = new Changes().value("b", 1, 2).value("a", 1, 2);

        assertThat(changes.payload().get("changed")).isEqualTo(List.of("b", "a"));
    }
}
