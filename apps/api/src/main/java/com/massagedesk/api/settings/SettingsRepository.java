package com.massagedesk.api.settings;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SettingsRepository extends JpaRepository<Settings, Boolean> {

    default Settings get() {
        return findById(true).orElseThrow();
    }

    /** Reads the row and locks it until the transaction ends; serialises settings writers. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Settings s where s.id = :id")
    Optional<Settings> findByIdForUpdate(@Param("id") Boolean id);

    /** The settings row, locked: use it in every update so a stale read is never written back. */
    default Settings getForUpdate() {
        return findByIdForUpdate(true).orElseThrow();
    }
}
