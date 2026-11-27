package com.massagedesk.api.push;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PushProperties.class)
class PushConfig {

    @Bean
    ExpoPushClient expoPushClient(PushProperties api, JsonMapper json) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(api.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(api.readTimeout());
        return new ExpoPushClient(RestClient.builder().requestFactory(factory), api, json);
    }
}
