package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class OutboundMessageTests {

    @Test
    void acceptsValidMessagesAcrossAllKinds() {
        Text text = new Text("a".repeat(4096));
        assertThat(text.body()).hasSize(4096);

        Buttons oneButton = new Buttons("Choose", List.of(new Button("b1", "Yes")));
        assertThat(oneButton.buttons()).hasSize(1);

        Buttons threeButtons = new Buttons(
                "b".repeat(1024),
                List.of(
                        new Button("id-1", "Option 1"),
                        new Button("id-2", "Option 2"),
                        new Button("id".repeat(128), "t".repeat(20))));
        assertThat(threeButtons.buttons()).hasSize(3);

        ListMenu oneRowWithoutDescription = new ListMenu(
                "Pick time",
                "Open",
                List.of(new Row("r1", "10:00", null)));
        assertThat(oneRowWithoutDescription.rows()).singleElement()
                .satisfies(row -> assertThat(row.description()).isNull());

        List<Row> tenRows = IntStream.rangeClosed(1, 10)
                .mapToObj(i -> new Row("row-" + i, "Title " + i, "d".repeat(72)))
                .toList();
        ListMenu fullList = new ListMenu("b".repeat(1024), "l".repeat(20), tenRows);
        assertThat(fullList.rows()).hasSize(10);

        Template ruWithoutParams = new Template("booking_confirmed_1", "ru", List.of());
        assertThat(ruWithoutParams.bodyParameters()).isEmpty();

        Template enUsWithParams = new Template(
                "a".repeat(512),
                "en_US",
                List.of("Aziza", "14:00    tomorrow", "p".repeat(1024)));
        assertThat(enUsWithParams.bodyParameters()).hasSize(3);
    }

    @Test
    void countsLengthInCodePointsForEmoji() {
        String emoji20 = "\uD83D\uDE0A".repeat(20);
        String emoji21 = "\uD83D\uDE0A".repeat(21);

        Button valid = new Button("btn-1", emoji20);
        assertThat(valid.title()).isEqualTo(emoji20);

        assertThatThrownBy(() -> new Button("btn-1", emoji21))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("button title must be 1..20 characters");
    }

    @Test
    void enforcesTextAndInteractiveBodyLengthBoundaries() {
        assertThat(new Text("x".repeat(4096)).body()).hasSize(4096);
        assertThatThrownBy(() -> new Text("x".repeat(4097)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("text body must be 1..4096 characters");

        List<Button> buttons = List.of(new Button("b1", "OK"));
        assertThat(new Buttons("x".repeat(1024), buttons).body()).hasSize(1024);
        assertThatThrownBy(() -> new Buttons("x".repeat(1025), buttons))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("interactive body must be 1..1024 characters");

        List<Row> rows = List.of(new Row("r1", "Row", null));
        assertThat(new ListMenu("x".repeat(1024), "Open", rows).body()).hasSize(1024);
        assertThatThrownBy(() -> new ListMenu("x".repeat(1025), "Open", rows))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("interactive body must be 1..1024 characters");
    }

    @Test
    void enforcesButtonAndListFieldLengthBoundaries() {
        assertThat(new Button("i".repeat(256), "t".repeat(20)).id()).hasSize(256);
        assertThatThrownBy(() -> new Button("i".repeat(257), "OK"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("button id must be 1..256 characters");
        assertThatThrownBy(() -> new Button("b1", "t".repeat(21)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("button title must be 1..20 characters");

        List<Row> rows = List.of(new Row("r".repeat(200), "t".repeat(24), "d".repeat(72)));
        assertThat(new ListMenu("Body", "l".repeat(20), rows).buttonLabel()).hasSize(20);
        assertThatThrownBy(() -> new ListMenu("Body", "l".repeat(21), rows))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("list buttonLabel must be 1..20 characters");

        assertThatThrownBy(() -> new Row("r".repeat(201), "Title", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("row id must be 1..200 characters");
        assertThatThrownBy(() -> new Row("r1", "t".repeat(25), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("row title must be 1..24 characters");
        assertThatThrownBy(() -> new Row("r1", "Title", "d".repeat(73)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("row description must be 1..72 characters");
    }

    @Test
    void enforcesButtonAndRowCountsAndUniqueness() {
        assertThatThrownBy(() -> new Buttons("Body", List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buttons count must be 1..3");

        List<Button> fourButtons = IntStream.rangeClosed(1, 4)
                .mapToObj(i -> new Button("b" + i, "Title " + i))
                .toList();
        assertThatThrownBy(() -> new Buttons("Body", fourButtons))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buttons count must be 1..3");

        assertThatThrownBy(() -> new Buttons("Body", List.of(new Button("dup", "Yes"), new Button("dup", "No"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("button id must be unique");

        assertThatThrownBy(() -> new Buttons("Body", List.of(new Button("b1", "Same"), new Button("b2", "Same"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("button title must be unique");

        assertThatThrownBy(() -> new ListMenu("Body", "Open", List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("list rows count must be 1..10");

        List<Row> elevenRows = IntStream.rangeClosed(1, 11)
                .mapToObj(i -> new Row("r" + i, "Row " + i, null))
                .toList();
        assertThatThrownBy(() -> new ListMenu("Body", "Open", elevenRows))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("list rows count must be 1..10");

        assertThatThrownBy(() -> new ListMenu(
                "Body",
                "Open",
                List.of(new Row("dup", "First", null), new Row("dup", "Second", null))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("row id must be unique");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t\n"})
    void rejectsNullEmptyOrBlankStrings(String blank) {
        assertThatThrownBy(() -> new Text(blank)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Button(blank, "OK")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Button("b1", blank)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Buttons(blank, List.of(new Button("b1", "OK"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Row(blank, "Title", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Row("r1", blank, null)).isInstanceOf(IllegalArgumentException.class);
        if (blank != null) {
            assertThatThrownBy(() -> new Row("r1", "Title", blank)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new ListMenu(blank, "Open", List.of(new Row("r1", "Title", null))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ListMenu("Body", blank, List.of(new Row("r1", "Title", null))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "ru", List.of(blank == null ? "" : blank)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNullListsAndNullElementsWithIllegalArgumentException() {
        assertThatThrownBy(() -> new Buttons("Body", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Buttons("Body", Arrays.asList(new Button("b1", "OK"), null)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new ListMenu("Body", "Open", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ListMenu("Body", "Open", Arrays.asList(new Row("r1", "Title", null), null)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new Template("booking", "ru", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "ru", Arrays.asList("Aziza", null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatesTemplateNameLanguageAndParameters() {
        assertThatThrownBy(() -> new Template(null, "ru", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("Booking", "ru", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking-confirm", "ru", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("a".repeat(513), "ru", List.of()))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new Template("booking", null, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "russian", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "en-US", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "en_us", List.of()))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new Template("booking", "ru", List.of("x".repeat(1025))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("template body parameter must be 1..1024 characters");
        assertThatThrownBy(() -> new Template("booking", "ru", List.of("line1\nline2")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "ru", List.of("col1\tcol2")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Template("booking", "ru", List.of("too     many spaces")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void copiesListsDefensively() {
        List<Button> mutableButtons = new ArrayList<>(List.of(new Button("b1", "Yes")));
        Buttons buttons = new Buttons("Body", mutableButtons);
        mutableButtons.add(new Button("b2", "No"));
        assertThat(buttons.buttons()).hasSize(1);
        assertThatThrownBy(() -> buttons.buttons().add(new Button("b3", "Maybe")))
                .isInstanceOf(UnsupportedOperationException.class);

        List<Row> mutableRows = new ArrayList<>(List.of(new Row("r1", "Row 1", null)));
        ListMenu menu = new ListMenu("Body", "Open", mutableRows);
        mutableRows.add(new Row("r2", "Row 2", null));
        assertThat(menu.rows()).hasSize(1);
        assertThatThrownBy(() -> menu.rows().clear())
                .isInstanceOf(UnsupportedOperationException.class);

        List<String> mutableParams = new ArrayList<>(List.of("Aziza"));
        Template template = new Template("booking", "ru", mutableParams);
        mutableParams.add("Extra");
        assertThat(template.bodyParameters()).containsExactly("Aziza");
        assertThatThrownBy(() -> template.bodyParameters().add("Another"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
