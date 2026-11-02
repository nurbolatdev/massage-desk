package com.massagedesk.api.security;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Staff profiles by auth user id. */
public interface StaffProfileRepository extends JpaRepository<StaffProfile, UUID> {
}
