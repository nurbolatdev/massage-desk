package com.massagedesk.api.schedule;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MassageServiceRepository extends JpaRepository<MassageService, UUID> {

    List<MassageService> findByActiveTrueOrderBySortOrderAscNameAsc();
}
