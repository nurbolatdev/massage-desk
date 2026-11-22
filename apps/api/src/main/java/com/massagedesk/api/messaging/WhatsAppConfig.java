package com.massagedesk.api.messaging;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(WhatsAppApiProperties.class)
class WhatsAppConfig {
}
