package com.massagedesk.api.messaging;

import java.net.http.HttpClient;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(WhatsAppApiProperties.class)
class WhatsAppConfig {

    @Bean
    WhatsAppClient whatsAppClient(WhatsAppApiProperties api, @Nullable JsonMapper json) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(api.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(api.readTimeout());
        JsonMapper mapper = json != null ? json : JsonMapper.builder().build();
        return new WhatsAppClient(RestClient.builder().requestFactory(factory), api, mapper);
    }
}
