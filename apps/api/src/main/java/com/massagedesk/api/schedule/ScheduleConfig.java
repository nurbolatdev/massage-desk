package com.massagedesk.api.schedule;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SlotProperties.class)
class ScheduleConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
