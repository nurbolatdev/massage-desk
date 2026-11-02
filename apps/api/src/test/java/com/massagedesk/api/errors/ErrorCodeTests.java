package com.massagedesk.api.errors;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.clients.ClientException;
import com.massagedesk.api.schedule.ScheduleException;
import com.massagedesk.api.settings.SettingsException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** The closed list of codes matches the reasons of the domain exceptions. */
class ErrorCodeTests {

    private static Set<String> names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).collect(Collectors.toSet());
    }

    private static Set<String> codes() {
        return names(ErrorCode.values());
    }

    private static Set<String> reasons() {
        Set<String> all = new TreeSet<>();
        Stream.of(BookingException.Reason.values(), ClientException.Reason.values(),
                ScheduleException.Reason.values(), SettingsException.Reason.values())
                .forEach(values -> all.addAll(names(values)));
        return all;
    }

    @Test
    void everyReasonHasACode() {
        for (String reason : reasons()) {
            assertThat(codes()).as("reason %s has no ErrorCode", reason).contains(reason);
        }
    }

    @Test
    void everyCodeIsProduced() {
        Set<String> produced = new TreeSet<>(reasons());
        produced.add("INVALID_REQUEST");
        for (String code : codes()) {
            assertThat(produced).as("ErrorCode %s is not produced by any reason", code).contains(code);
        }
    }

    @Test
    void codesAreSortedAlphabetically() {
        List<String> actual = Arrays.stream(ErrorCode.values()).map(Enum::name).toList();
        assertThat(actual).isSortedAccordingTo(Comparator.naturalOrder());
    }
}
