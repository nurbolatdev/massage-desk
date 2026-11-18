package com.massagedesk.api.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;

/** A period when the master does not work (vacation, day off). */
@Entity
@Table(name = "time_off")
public class TimeOff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Convert(converter = TimeRangeConverter.class)
    @Column(name = "period", nullable = false, columnDefinition = "tstzrange")
    @ColumnTransformer(write = "cast(? as tstzrange)")
    private TimeRange period;

    @Column(name = "reason")
    private String reason;

    protected TimeOff() {
    }

    public TimeOff(TimeRange period, String reason) {
        this.period = Objects.requireNonNull(period, "period");
        this.reason = reason;
    }

    public UUID getId() {
        return id;
    }

    public TimeRange getPeriod() {
        return period;
    }

    public String getReason() {
        return reason;
    }
}
