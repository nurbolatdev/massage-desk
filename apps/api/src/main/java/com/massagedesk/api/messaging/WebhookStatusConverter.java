package com.massagedesk.api.messaging;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link WebhookStatus} to its lowercase database value. */
@Converter
public class WebhookStatusConverter extends LowercaseEnumConverter<WebhookStatus> {

    public WebhookStatusConverter() {
        super(WebhookStatus.class);
    }
}
