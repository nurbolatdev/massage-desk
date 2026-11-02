package com.massagedesk.api.schedule;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WorkingHoursRepository extends JpaRepository<WorkingHours, UUID> {

    /**
     * Advisory lock key that serialises replacements of the week. Keys in use: 7_301_001
     * (appointments, see {@code AppointmentService}) and this one.
     */
    long WRITE_LOCK = 7_301_002L;

    List<WorkingHours> findByWeekdayOrderByStartTimeAsc(DayOfWeek weekday);

    List<WorkingHours> findAllByOrderByWeekdayAscStartTimeAsc();

    /** Takes a transaction-scoped advisory lock on {@link #WRITE_LOCK}, released at commit or rollback. */
    @Query(nativeQuery = true, value = "select cast(pg_advisory_xact_lock(" + WRITE_LOCK + ") as text)")
    String lockWrites();
}
