package com.massagedesk.api.booking;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    /**
     * Confirmed appointments that overlap the half-open window. Only confirmed
     * appointments hold time, the same rule as the {@code appointments_no_overlap}
     * constraint.
     */
    @Query(nativeQuery = true, value = """
            select a.* from appointments a
            where a.status = 'confirmed'
              and a.period && tstzrange(cast(:windowStart as timestamptz), cast(:windowEnd as timestamptz), '[)')
            order by lower(a.period)
            """)
    List<Appointment> findConfirmedOverlapping(
            @Param("windowStart") Instant windowStart, @Param("windowEnd") Instant windowEnd);
}
