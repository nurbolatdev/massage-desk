package com.massagedesk.api.schedule;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TimeOffRepository extends JpaRepository<TimeOff, UUID> {

    /**
     * Time off that overlaps the half-open window, including periods that start
     * before it or end after it.
     */
    @Query(nativeQuery = true, value = """
            select t.* from time_off t
            where t.period && tstzrange(cast(:windowStart as timestamptz), cast(:windowEnd as timestamptz), '[)')
            order by lower(t.period)
            """)
    List<TimeOff> findOverlapping(
            @Param("windowStart") Instant windowStart, @Param("windowEnd") Instant windowEnd);
}
