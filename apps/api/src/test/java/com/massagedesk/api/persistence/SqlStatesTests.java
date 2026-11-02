package com.massagedesk.api.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;

class SqlStatesTests {

    @Test
    void directSqlException() {
        var e = new SQLException("dup", "23505");

        assertThat(SqlStates.has(e, SqlStates.UNIQUE_VIOLATION)).isTrue();
        assertThat(SqlStates.has(e, SqlStates.EXCLUSION_VIOLATION)).isFalse();
    }

    @Test
    void nestedTwoLevels() {
        var e = new RuntimeException("outer", new IllegalStateException("middle", new SQLException("x", "23505")));

        assertThat(SqlStates.has(e, SqlStates.UNIQUE_VIOLATION)).isTrue();
    }

    @Test
    void causeCycleTerminates() {
        var a = new RuntimeException("a");
        var b = new RuntimeException("b", a);
        a.initCause(b);

        assertThat(SqlStates.has(a, SqlStates.UNIQUE_VIOLATION)).isFalse();
    }

    @Test
    void withoutSqlException() {
        var e = new RuntimeException("wrapper", new IllegalStateException("plain"));

        assertThat(SqlStates.has(e, SqlStates.UNIQUE_VIOLATION)).isFalse();
    }
}
