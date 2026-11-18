package com.massagedesk.api.schedule;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one lock that orders every write that changes free time: booking, rescheduling, adding time
 * off and replacing the working hours. Each of them reads the others' rows to decide whether the
 * time is free, so without a shared lock two of them could both commit, each blind to the other's
 * uncommitted rows. The lock is transaction-scoped (released at commit or rollback); the
 * exclusion constraint on appointments stays the final guard against double booking.
 *
 * <p>Lock order: the advisory lock is always taken before any row lock, never after one. Writes
 * that only free time (cancel, no-show, removing time off) do not take it.
 */
@Component
public class ScheduleLock {

    /** Advisory lock key shared by all schedule writes (one master). */
    public static final long KEY = 7_301_001L;

    private final EntityManager entityManager;

    public ScheduleLock(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Waits for and takes the lock; fails when called outside a transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void acquire() {
        entityManager.createNativeQuery("select cast(pg_advisory_xact_lock(:key) as text)")
                .setParameter("key", KEY)
                .getSingleResult();
    }
}
