package com.massagedesk.api.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Objects;
import java.util.UUID;

/** A massage the master offers (table {@code services}); not named {@code Service} to avoid clashing with Spring's stereotype. */
@Entity
@Table(name = "services")
public class MassageService {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected MassageService() {
    }

    public MassageService(String name, int durationMin, BigDecimal price, int sortOrder) {
        this.name = Objects.requireNonNull(name, "name");
        Objects.requireNonNull(price, "price");
        if (durationMin <= 0) {
            throw new IllegalArgumentException("duration must be positive: " + durationMin);
        }
        if (price.signum() < 0) {
            throw new IllegalArgumentException("price must not be negative: " + price);
        }
        this.durationMin = durationMin;
        this.price = price;
        this.sortOrder = sortOrder;
        this.active = true;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getDurationMin() {
        return durationMin;
    }

    public Duration getDuration() {
        return Duration.ofMinutes(durationMin);
    }

    public BigDecimal getPrice() {
        return price;
    }

    public boolean isActive() {
        return active;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
