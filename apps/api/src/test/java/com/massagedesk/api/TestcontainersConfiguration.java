package com.massagedesk.api;

import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	public PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
				.withTmpFs(Map.of("/var/lib/postgresql/data", "rw"));
	}

	/** Tests never send real messages, even when WHATSAPP_* variables are exported in the shell. */
	@Bean
	public DynamicPropertyRegistrar noWhatsAppSending() {
		return registry -> registry.add("app.whatsapp.api.url", () -> "");
	}

}
