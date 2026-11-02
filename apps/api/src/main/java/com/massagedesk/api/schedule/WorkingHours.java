package com.massagedesk.api.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.JdbcType;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;

/**
 * A working block of one weekday. Several rows per day are blocks around a break
 * (matches {@code SlotCalculator.WorkingBlock}).
 */
@Entity
@Table(name = "working_hours")
public class WorkingHours {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Convert(converter = DayOfWeekConverter.class)
    @Column(name = "weekday", nullable = false)
    private DayOfWeek weekday;

    // local wall-clock time: bound as is, never shifted by hibernate.jdbc.time_zone or the JVM zone
    @JdbcType(LocalTimeJdbcType.class)
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @JdbcType(LocalTimeJdbcType.class)
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    protected WorkingHours() {
    }

    public WorkingHours(DayOfWeek weekday, LocalTime startTime, LocalTime endTime) {
        this.weekday = Objects.requireNonNull(weekday, "weekday");
        this.startTime = Objects.requireNonNull(startTime, "startTime");
        this.endTime = Objects.requireNonNull(endTime, "endTime");
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("startTime must be before endTime");
        }
    }

    public UUID getId() {
        return id;
    }

    public DayOfWeek getWeekday() {
        return weekday;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }
}
