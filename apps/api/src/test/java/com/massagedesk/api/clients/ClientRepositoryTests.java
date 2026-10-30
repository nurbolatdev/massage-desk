package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ClientRepositoryTests {

    @Autowired
    private ClientRepository clients;

    @Autowired
    private EntityManager entityManager;

    @Test
    void findsClientByPhoneWithDatabaseCreatedAt() {
        clients.saveAndFlush(new Client("+998900000101", "Aziza"));
        entityManager.clear();

        Client found = clients.findByPhone("+998900000101").orElseThrow();

        assertThat(found.getName()).isEqualTo("Aziza");
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsDuplicatePhone() {
        clients.saveAndFlush(new Client("+998900000102", "First"));

        assertThatThrownBy(() -> clients.saveAndFlush(new Client("+998900000102", "Second")))
                .isInstanceOf(DataIntegrityViolationException.class)
                .rootCause().hasMessageContaining("clients_phone_key");
    }
}
