package com.massagedesk.api.schedule;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MassageServiceRepository extends JpaRepository<MassageService, UUID> {

    List<MassageService> findByActiveTrueOrderBySortOrderAscNameAsc();

    Optional<MassageService> findByIdAndActiveTrue(UUID id);

    List<MassageService> findAllByOrderBySortOrderAscNameAsc();

    @Query("select coalesce(max(s.sortOrder), -1) from MassageService s")
    int maxSortOrder();
}
