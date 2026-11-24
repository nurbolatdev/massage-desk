package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.messaging.WebhookPayload.InboundMessage;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class WebhookPayloadTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void readsTextMessageWithContactProfileNameAndTimestamp() {
        JsonNode root = parse("""
                {
                  "object": "whatsapp_business_account",
                  "entry": [
                    {
                      "id": "entry-1",
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                              "display_phone_number": "998900000000",
                              "phone_number_id": "100000000000000"
                            },
                            "contacts": [
                              {
                                "profile": { "name": "Aziza" },
                                "wa_id": "998901234567"
                              }
                            ],
                            "messages": [
                              {
                                "from": "998901234567",
                                "id": "wamid.test-1",
                                "timestamp": "1700000000",
                                "type": "text",
                                "text": { "body": "Здравствуйте, можно записаться?" }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """);

        assertThat(WebhookPayload.messages(root)).containsExactly(
                new InboundMessage(
                        "wamid.test-1",
                        "998901234567",
                        "Aziza",
                        "text",
                        "Здравствуйте, можно записаться?",
                        Instant.ofEpochSecond(1700000000L),
                        null));
    }

    @Test
    void keepsNonTextStoredTypesWithNullBodyAndSkipsReactionsSystemAndUnknownTypes() {
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              {
                                "from": "998901234567",
                                "id": "wamid.test-image",
                                "timestamp": "1700000001",
                                "type": "image",
                                "image": { "id": "media-1" },
                                "text": { "body": "ignored for non-text" }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.test-reaction",
                                "timestamp": "1700000002",
                                "type": "reaction"
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.test-system",
                                "timestamp": "1700000003",
                                "type": "system"
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.test-future",
                                "timestamp": "1700000004",
                                "type": "future_type"
                              }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """);

        assertThat(WebhookPayload.messages(root)).containsExactly(
                new InboundMessage(
                        "wamid.test-image",
                        "998901234567",
                        null,
                        "image",
                        null,
                        Instant.ofEpochSecond(1700000001L),
                        null));
    }

    @Test
    void readsButtonReplyListReplyAndTemplateButtonAndRejectsBlankOrOverlongReplyIds() {
        String id256 = "r".repeat(256);
        String id257 = "r".repeat(257);
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              {
                                "from": "998901234567",
                                "id": "wamid.btn-reply",
                                "timestamp": "1700000001",
                                "type": "interactive",
                                "interactive": {
                                  "type": "button_reply",
                                  "button_reply": { "id": "book", "title": "Записаться" }
                                }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.list-reply",
                                "timestamp": "1700000002",
                                "type": "interactive",
                                "interactive": {
                                  "type": "list_reply",
                                  "list_reply": {
                                    "id": "service:11111111-1111-1111-1111-111111111111",
                                    "title": "Классический массаж",
                                    "description": "60 мин · 8 000 ₸"
                                  }
                                }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.template-btn",
                                "timestamp": "1700000003",
                                "type": "button",
                                "button": { "payload": "confirm_yes", "text": "Подтвердить" }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.other-interactive",
                                "timestamp": "1700000004",
                                "type": "interactive",
                                "interactive": {
                                  "type": "nfm_reply",
                                  "nfm_reply": { "name": "flow" }
                                }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.blank-reply-id",
                                "timestamp": "1700000005",
                                "type": "interactive",
                                "interactive": {
                                  "type": "button_reply",
                                  "button_reply": { "id": "   ", "title": "Записаться" }
                                }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.overlong-reply-id",
                                "timestamp": "1700000006",
                                "type": "interactive",
                                "interactive": {
                                  "type": "list_reply",
                                  "list_reply": { "id": "%s", "title": "Слишком длинный" }
                                }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.max-reply-id",
                                "timestamp": "1700000007",
                                "type": "button",
                                "button": { "payload": "  %s  ", "text": "Максимум" }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """.formatted(id257, id256));

        assertThat(WebhookPayload.messages(root)).containsExactly(
                new InboundMessage(
                        "wamid.btn-reply",
                        "998901234567",
                        null,
                        "interactive",
                        "Записаться",
                        Instant.ofEpochSecond(1700000001L),
                        "book"),
                new InboundMessage(
                        "wamid.list-reply",
                        "998901234567",
                        null,
                        "interactive",
                        "Классический массаж",
                        Instant.ofEpochSecond(1700000002L),
                        "service:11111111-1111-1111-1111-111111111111"),
                new InboundMessage(
                        "wamid.template-btn",
                        "998901234567",
                        null,
                        "button",
                        "Подтвердить",
                        Instant.ofEpochSecond(1700000003L),
                        "confirm_yes"),
                new InboundMessage(
                        "wamid.other-interactive",
                        "998901234567",
                        null,
                        "interactive",
                        null,
                        Instant.ofEpochSecond(1700000004L),
                        null),
                new InboundMessage(
                        "wamid.blank-reply-id",
                        "998901234567",
                        null,
                        "interactive",
                        "Записаться",
                        Instant.ofEpochSecond(1700000005L),
                        null),
                new InboundMessage(
                        "wamid.overlong-reply-id",
                        "998901234567",
                        null,
                        "interactive",
                        "Слишком длинный",
                        Instant.ofEpochSecond(1700000006L),
                        null),
                new InboundMessage(
                        "wamid.max-reply-id",
                        "998901234567",
                        null,
                        "button",
                        "Максимум",
                        Instant.ofEpochSecond(1700000007L),
                        id256));
    }

    @Test
    void skipsMalformedMessagesAndKeepsValidNeighbors() {
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              {
                                "from": "998901234567",
                                "id": "wamid.test-before",
                                "timestamp": "1700000001",
                                "type": "text",
                                "text": { "body": "first" }
                              },
                              {
                                "from": "998901234567",
                                "timestamp": "1700000002",
                                "type": "text",
                                "text": { "body": "missing id" }
                              },
                              {
                                "id": "wamid.test-no-from",
                                "timestamp": "1700000002",
                                "type": "text",
                                "text": { "body": "missing from" }
                              },
                              {
                                "from": 998901234567,
                                "id": "wamid.test-numeric-from",
                                "timestamp": "1700000002",
                                "type": "text",
                                "text": { "body": "numeric from" }
                              },
                              {
                                "from": "998901234567",
                                "id": "   ",
                                "timestamp": "1700000002",
                                "type": "text",
                                "text": { "body": "blank id" }
                              },
                              {
                                "from": "998901234567",
                                "id": "wamid.test-after",
                                "timestamp": "1700000003",
                                "type": "text",
                                "text": { "body": "second" }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """);

        assertThat(WebhookPayload.messages(root))
                .extracting(InboundMessage::waMessageId, InboundMessage::text)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("wamid.test-before", "first"),
                        org.assertj.core.groups.Tuple.tuple("wamid.test-after", "second"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            """
            {
              "entry": [
                {
                  "changes": [
                    {
                      "field": "messages",
                      "value": {
                        "statuses": [
                          { "id": "wamid.status-1", "status": "delivered" }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
            """,
            """
            {
              "entry": [
                {
                  "changes": [
                    {
                      "field": "message_template_status_update",
                      "value": {
                        "messages": [
                          {
                            "from": "998901234567",
                            "id": "wamid.test-1",
                            "type": "text",
                            "text": { "body": "ignored field" }
                          }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
            """,
            """
            { "object": "whatsapp_business_account" }
            """,
            """
            {
              "entry": {
                "changes": [
                  {
                    "field": "messages",
                    "value": {
                      "messages": [
                        { "from": "998901234567", "id": "wamid.test-1", "type": "text" }
                      ]
                    }
                  }
                ]
              }
            }
            """,
            """
            {
              "entry": [
                {
                  "changes": [
                    {
                      "field": "messages",
                      "value": {
                        "messages": {
                          "from": "998901234567",
                          "id": "wamid.test-1",
                          "type": "text"
                        }
                      }
                    }
                  ]
                }
              ]
            }
            """
    })
    void returnsEmptyWhenNoMessageArrayIsPresent(String payload) {
        assertThat(WebhookPayload.messages(parse(payload))).isEmpty();
    }

    @Test
    void preservesOrderAcrossMultipleEntriesAndChanges() {
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "id": "entry-1",
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              { "from": "998901234567", "id": "wamid.test-1", "type": "text", "text": { "body": "1" } },
                              { "from": "998901234567", "id": "wamid.test-2", "type": "text", "text": { "body": "2" } }
                            ]
                          }
                        },
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              { "from": "998901234567", "id": "wamid.test-3", "type": "text", "text": { "body": "3" } }
                            ]
                          }
                        }
                      ]
                    },
                    {
                      "id": "entry-2",
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              { "from": "998901234567", "id": "wamid.test-4", "type": "text", "text": { "body": "4" } }
                            ]
                          }
                        },
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              { "from": "998901234567", "id": "wamid.test-5", "type": "text", "text": { "body": "5" } }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """);

        assertThat(WebhookPayload.messages(root))
                .extracting(InboundMessage::waMessageId)
                .containsExactly("wamid.test-1", "wamid.test-2", "wamid.test-3", "wamid.test-4", "wamid.test-5");
    }

    @Test
    void normalizesAndTruncatesContactNamesByCodePoints() {
        String longAscii = "A".repeat(150);
        String emoji101 = "\uD83D\uDE0A".repeat(101);
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "contacts": [
                              { "wa_id": "998901234561", "profile": { "name": "  Aziza  " } },
                              { "wa_id": "998901234562", "profile": { "name": "   " } },
                              { "wa_id": "998901234564", "profile": { "name": "%s" } },
                              { "wa_id": "998901234565", "profile": { "name": "%s" } }
                            ],
                            "messages": [
                              { "from": "998901234561", "id": "wamid.test-1", "type": "text" },
                              { "from": "998901234562", "id": "wamid.test-2", "type": "text" },
                              { "from": "998901234563", "id": "wamid.test-3", "type": "text" },
                              { "from": "998901234564", "id": "wamid.test-4", "type": "text" },
                              { "from": "998901234565", "id": "wamid.test-5", "type": "text" }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """.formatted(longAscii, emoji101));

        List<InboundMessage> messages = WebhookPayload.messages(root);
        assertThat(messages).hasSize(5);
        assertThat(messages.get(0).profileName()).isEqualTo("Aziza");
        assertThat(messages.get(1).profileName()).isNull();
        assertThat(messages.get(2).profileName()).isNull();
        assertThat(messages.get(3).profileName())
                .isEqualTo("A".repeat(100))
                .satisfies(name -> assertThat(name.codePointCount(0, name.length())).isEqualTo(100));

        String truncatedEmoji = messages.get(4).profileName();
        assertThat(truncatedEmoji)
                .isNotNull()
                .isEqualTo("\uD83D\uDE0A".repeat(100));
        assertThat(truncatedEmoji.codePointCount(0, truncatedEmoji.length())).isEqualTo(100);
        assertThat(Character.isLowSurrogate(truncatedEmoji.charAt(truncatedEmoji.length() - 1))).isTrue();
    }

    @Test
    void parsesValidTimestampsAndReturnsNullForMalformedOnes() {
        JsonNode root = parse("""
                {
                  "entry": [
                    {
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "messages": [
                              { "from": "998901234567", "id": "wamid.test-missing", "type": "text" },
                              { "from": "998901234567", "id": "wamid.test-alpha", "timestamp": "abc", "type": "text" },
                              { "from": "998901234567", "id": "wamid.test-zero", "timestamp": "0", "type": "text" },
                              { "from": "998901234567", "id": "wamid.test-neg", "timestamp": "-5", "type": "text" },
                              { "from": "998901234567", "id": "wamid.test-13digits", "timestamp": "1700000000000", "type": "text" },
                              { "from": "998901234567", "id": "wamid.test-number", "timestamp": 1700000000, "type": "text" }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """);

        List<InboundMessage> messages = WebhookPayload.messages(root);
        assertThat(messages).hasSize(6);
        assertThat(messages.subList(0, 5))
                .extracting(InboundMessage::sentAt)
                .containsOnlyNulls();
        assertThat(messages.get(5).sentAt()).isEqualTo(Instant.ofEpochSecond(1700000000L));
    }

    private static JsonNode parse(String json) {
        return JSON.readTree(json);
    }
}
