package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;

class OverlapViolationsTests {

    @Test
    void exclusionViolationAsDirectCause() {
        var e = new RuntimeException("wrapper", new SQLException("overlap", "23P01"));

        assertThat(OverlapViolations.isOverlap(e)).isTrue();
    }

    @Test
    void exclusionViolationNestedTwoLevels() {
        var e = new RuntimeException("outer", new IllegalStateException("middle", new SQLException("x", "23P01")));

        assertThat(OverlapViolations.isOverlap(e)).isTrue();
    }

    @Test
    void uniqueViolationIsNotOverlap() {
        var e = new RuntimeException("wrapper", new SQLException("dup", "23505"));

        assertThat(OverlapViolations.isOverlap(e)).isFalse();
    }

    @Test
    void withoutSqlExceptionIsNotOverlap() {
        var e = new RuntimeException("wrapper", new IllegalStateException("plain"));

        assertThat(OverlapViolations.isOverlap(e)).isFalse();
    }
}
