package com.massagedesk.api.messaging;

import static com.massagedesk.api.messaging.WhatsAppRequests.body;
import static com.massagedesk.api.messaging.WhatsAppRequests.recipient;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class WhatsAppRequestsTests {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void buildsTextMessageBody() {
        ObjectNode actual = body("+998901234567", new Text("Запись подтверждена на 14:00"), json);

        assertThat(actual).isEqualTo(json.readTree("""
                {
                  "messaging_product": "whatsapp",
                  "recipient_type": "individual",
                  "to": "998901234567",
                  "type": "text",
                  "text": {
                    "preview_url": false,
                    "body": "Запись подтверждена на 14:00"
                  }
                }
                """));
    }

    @Test
    void buildsButtonsMessageBodyPreservingOrder() {
        Buttons message = new Buttons(
                "Выберите действие",
                List.of(
                        new Button("confirm", "Подтвердить"),
                        new Button("reschedule", "Перенести"),
                        new Button("cancel", "Отменить")));

        ObjectNode actual = body("+998901234567", message, json);

        assertThat(actual).isEqualTo(json.readTree("""
                {
                  "messaging_product": "whatsapp",
                  "recipient_type": "individual",
                  "to": "998901234567",
                  "type": "interactive",
                  "interactive": {
                    "type": "button",
                    "body": {
                      "text": "Выберите действие"
                    },
                    "action": {
                      "buttons": [
                        {
                          "type": "reply",
                          "reply": {
                            "id": "confirm",
                            "title": "Подтвердить"
                          }
                        },
                        {
                          "type": "reply",
                          "reply": {
                            "id": "reschedule",
                            "title": "Перенести"
                          }
                        },
                        {
                          "type": "reply",
                          "reply": {
                            "id": "cancel",
                            "title": "Отменить"
                          }
                        }
                      ]
                    }
                  }
                }
                """));
    }

    @Test
    void buildsListMenuBodyWithAndWithoutRowDescriptionPreservingOrder() {
        ListMenu message = new ListMenu(
                "Выберите услугу",
                "Услуги",
                List.of(
                        new Row("classic-60", "Классический массаж", "60 минут"),
                        new Row("back-30", "Массаж спины", null),
                        new Row("sport-90", "Спортивный массаж", "90 минут")));

        ObjectNode actual = body("+998901234567", message, json);

        assertThat(actual).isEqualTo(json.readTree("""
                {
                  "messaging_product": "whatsapp",
                  "recipient_type": "individual",
                  "to": "998901234567",
                  "type": "interactive",
                  "interactive": {
                    "type": "list",
                    "body": {
                      "text": "Выберите услугу"
                    },
                    "action": {
                      "button": "Услуги",
                      "sections": [
                        {
                          "rows": [
                            {
                              "id": "classic-60",
                              "title": "Классический массаж",
                              "description": "60 минут"
                            },
                            {
                              "id": "back-30",
                              "title": "Массаж спины"
                            },
                            {
                              "id": "sport-90",
                              "title": "Спортивный массаж",
                              "description": "90 минут"
                            }
                          ]
                        }
                      ]
                    }
                  }
                }
                """));
    }

    @Test
    void buildsTemplateBodyWithParameters() {
        Template message = new Template(
                "booking_reminder",
                "ru",
                List.of("Азиза", "14:00"));

        ObjectNode actual = body("+998901234567", message, json);

        assertThat(actual).isEqualTo(json.readTree("""
                {
                  "messaging_product": "whatsapp",
                  "recipient_type": "individual",
                  "to": "998901234567",
                  "type": "template",
                  "template": {
                    "name": "booking_reminder",
                    "language": {
                      "code": "ru"
                    },
                    "components": [
                      {
                        "type": "body",
                        "parameters": [
                          {
                            "type": "text",
                            "text": "Азиза"
                          },
                          {
                            "type": "text",
                            "text": "14:00"
                          }
                        ]
                      }
                    ]
                  }
                }
                """));
    }

    @Test
    void buildsTemplateBodyOmittingComponentsWhenParametersAreEmpty() {
        Template message = new Template("hello_world", "en_US", List.of());

        ObjectNode actual = body("+998901234567", message, json);

        assertThat(actual).isEqualTo(json.readTree("""
                {
                  "messaging_product": "whatsapp",
                  "recipient_type": "individual",
                  "to": "998901234567",
                  "type": "template",
                  "template": {
                    "name": "hello_world",
                    "language": {
                      "code": "en_US"
                    }
                  }
                }
                """));
    }

    @Test
    void stripsLeadingPlusFromValidRecipient() {
        assertThat(recipient("+998901234567")).isEqualTo("998901234567");
        assertThat(recipient("+1234567")).isEqualTo("1234567");
        assertThat(recipient("+123456789012345")).isEqualTo("123456789012345");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
            "998901234567",
            "+0123456",
            "+99890 123",
            "+1234567890123456",
            "+123456",
            "+998-90-123-45-67"
    })
    void rejectsInvalidRecipientWithoutLeakingDigits(@org.jspecify.annotations.Nullable String invalid) {
        String digits = invalid == null ? "" : invalid.replaceAll("\\D", "");

        assertThatThrownBy(() -> recipient(invalid))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> {
                    if (!digits.isEmpty()) {
                        assertThat(ex.getMessage()).doesNotContain(digits);
                    }
                });

        assertThatThrownBy(() -> body(invalid, new Text("Привет"), json))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> {
                    if (!digits.isEmpty()) {
                        assertThat(ex.getMessage()).doesNotContain(digits);
                    }
                });
    }
}
