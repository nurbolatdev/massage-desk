package com.massagedesk.api.schedule;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkingHoursRepository extends JpaRepository<WorkingHours, UUID> {

    List<WorkingHours> findByWeekdayOrderByStartTimeAsc(DayOfWeek weekday);
}
