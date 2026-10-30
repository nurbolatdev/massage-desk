package com.massagedesk.api.settings;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingsRepository extends JpaRepository<Settings, Boolean> {

    default Settings get() {
        return findById(true).orElseThrow();
    }
}
