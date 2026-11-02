package com.massagedesk.api.booking;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    /** Loads the appointment with a row lock; serialises status changes of one appointment. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a where a.id = :id")
    Optional<Appointment> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Takes a transaction-scoped advisory lock, released at commit or rollback. It only orders
     * writers of confirmed periods so the database never has to resolve a mutual wait between
     * overlapping inserts; the exclusion constraint stays the real guard.
     */
    @Query(nativeQuery = true, value = "select cast(pg_advisory_xact_lock(:key) as text)")
    String lockWrites(@Param("key") long key);
}
