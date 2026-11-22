package com.massagedesk.api.messaging;

import java.util.Objects;
import java.util.regex.Pattern;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * JSON bodies of {@code POST /{phone-number-id}/messages}.
 */
final class WhatsAppRequests {

    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{6,14}$");

    private WhatsAppRequests() {
    }

    static String recipient(String e164) {
        if (e164 == null || !E164.matcher(e164).matches()) {
            throw new IllegalArgumentException("recipient must be in E.164 format");
        }
        return e164.substring(1);
    }

    static ObjectNode body(String recipientE164, OutboundMessage message, JsonMapper json) {
        String to = recipient(recipientE164);
        Objects.requireNonNull(message, "message");
        Objects.requireNonNull(json, "json");

        ObjectNode root = json.createObjectNode();
        root.put("messaging_product", "whatsapp");
        root.put("recipient_type", "individual");
        root.put("to", to);

        switch (message) {
            case OutboundMessage.Text text -> {
                root.put("type", "text");
                root.putObject("text")
                        .put("preview_url", false)
                        .put("body", text.body());
            }
            case OutboundMessage.Buttons buttons -> {
                root.put("type", "interactive");
                ObjectNode interactive = root.putObject("interactive");
                interactive.put("type", "button");
                interactive.putObject("body").put("text", buttons.body());
                ArrayNode buttonArray = interactive.putObject("action").putArray("buttons");
                for (OutboundMessage.Button button : buttons.buttons()) {
                    ObjectNode buttonNode = buttonArray.addObject();
                    buttonNode.put("type", "reply");
                    buttonNode.putObject("reply")
                            .put("id", button.id())
                            .put("title", button.title());
                }
            }
            case OutboundMessage.ListMenu listMenu -> {
                root.put("type", "interactive");
                ObjectNode interactive = root.putObject("interactive");
                interactive.put("type", "list");
                interactive.putObject("body").put("text", listMenu.body());
                ObjectNode action = interactive.putObject("action");
                action.put("button", listMenu.buttonLabel());
                ArrayNode rows = action.putArray("sections").addObject().putArray("rows");
                for (OutboundMessage.Row row : listMenu.rows()) {
                    ObjectNode rowNode = rows.addObject();
                    rowNode.put("id", row.id());
                    rowNode.put("title", row.title());
                    if (row.description() != null) {
                        rowNode.put("description", row.description());
                    }
                }
            }
            case OutboundMessage.Template template -> {
                root.put("type", "template");
                ObjectNode templateNode = root.putObject("template");
                templateNode.put("name", template.name());
                templateNode.putObject("language").put("code", template.languageCode());
                if (!template.bodyParameters().isEmpty()) {
                    ObjectNode bodyComponent = templateNode.putArray("components").addObject();
                    bodyComponent.put("type", "body");
                    ArrayNode parameters = bodyComponent.putArray("parameters");
                    for (String param : template.bodyParameters()) {
                        parameters.addObject()
                                .put("type", "text")
                                .put("text", param);
                    }
                }
            }
        }
        return root;
    }
}
