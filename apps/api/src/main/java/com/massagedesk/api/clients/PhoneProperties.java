package com.massagedesk.api.clients;

import com.google.i18n.phonenumbers.PhoneNumberUtil;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Phone settings from {@code application.yml}.
 *
 * @param defaultRegion region code (for example {@code UZ}) used to read numbers typed without a plus sign
 */
@ConfigurationProperties("app.phone")
public record PhoneProperties(String defaultRegion) {

    public PhoneProperties {
        if (defaultRegion == null || !PhoneNumberUtil.getInstance().getSupportedRegions().contains(defaultRegion)) {
            throw new IllegalArgumentException("app.phone.default-region must be a supported region code, e.g. UZ");
        }
    }
}
