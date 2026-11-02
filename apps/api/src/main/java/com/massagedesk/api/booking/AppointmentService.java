package com.massagedesk.api.booking;

import com.massagedesk.api.booking.BookingException.Reason;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only way appointments change. Free-time rules come from the schedule; double booking is
 * refused by the database constraint, not by a check in code.
 */
@Service
public class AppointmentService {

    /** Key of the advisory lock that orders all writes of confirmed periods (one master). */
    private static final long APPOINTMENT_WRITE_LOCK = 7_301_001L;

    /** An appointment as seen by callers; {@code zone} is the master's zone for display. */
    public record AppointmentView(
            UUID id,
            UUID clientId,
            UUID serviceId,
            TimeRange period,
            AppointmentStatus status,
            AppointmentSource source,
            ZoneId zone) {
    }

    private final AppointmentRepository appointments;
    private final ClientRepository clients;
    private final MassageServiceRepository services;
    private final SlotService slotService;
    private final SettingsRepository settings;
    private final Clock clock;
    private final DomainEventRecorder recorder;

    public AppointmentService(
            AppointmentRepository appointments,
            ClientRepository clients,
            MassageServiceRepository services,
            SlotService slotService,
            SettingsRepository settings,
            Clock clock,
            DomainEventRecorder recorder) {
        this.appointments = appointments;
        this.clients = clients;
        this.services = services;
        this.slotService = slotService;
        this.settings = settings;
        this.clock = clock;
        this.recorder = recorder;
    }

    /** Books the service for the client; the end is the start plus the service length. */
    @Transactional
    public AppointmentView create(UUID clientId, UUID serviceId, Instant start, AppointmentSource source, EventActor actor) {
        appointments.lockWrites(APPOINTMENT_WRITE_LOCK);
        Client client = clients.findById(clientId)
                .orElseThrow(() -> new BookingException(Reason.CLIENT_NOT_FOUND, "client not found"));
        MassageService service = services.findByIdAndActiveTrue(serviceId)
                .orElseThrow(() -> new BookingException(Reason.SERVICE_NOT_FOUND, "service not found"));
        TimeRange period = new TimeRange(start, start.plus(service.getDuration()));
        if (!slotService.fitsSchedule(period)) {
            throw new BookingException(
                    Reason.OUTSIDE_SCHEDULE, "time is outside working hours, in time off or in the past");
        }
        Appointment saved = flush(new Appointment(client, service, period, source));
        Map<String, Object> payload = payload(saved);
        payload.put("source", source.name().toLowerCase(Locale.ROOT));
        recorder.record(DomainEventType.APPOINTMENT_CREATED, saved.getId(), actor, payload);
        return view(saved);
    }

    /** Moves a confirmed appointment, keeping its booked length. */
    @Transactional
    public AppointmentView reschedule(UUID id, Instant start, EventActor actor) {
        appointments.lockWrites(APPOINTMENT_WRITE_LOCK);
        Appointment appointment = locked(id);
        appointment.requireConfirmed();
        TimeRange old = appointment.getPeriod();
        TimeRange period = new TimeRange(start, start.plus(Duration.between(old.start(), old.end())));
        if (!slotService.fitsSchedule(period)) {
            throw new BookingException(
                    Reason.OUTSIDE_SCHEDULE, "time is outside working hours, in time off or in the past");
        }
        appointment.reschedule(period);
        Appointment saved = flush(appointment);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("client_id", saved.getClient().getId().toString());
        payload.put("service_id", saved.getService().getId().toString());
        payload.put("previous_start", old.start().toString());
        payload.put("previous_end", old.end().toString());
        payload.put("start", period.start().toString());
        payload.put("end", period.end().toString());
        recorder.record(DomainEventType.APPOINTMENT_RESCHEDULED, saved.getId(), actor, payload);
        return view(saved);
    }

    /** Cancels a confirmed appointment. */
    @Transactional
    public AppointmentView cancel(UUID id, EventActor actor) {
        Appointment appointment = locked(id);
        appointment.cancel();
        Appointment saved = flush(appointment);
        recorder.record(DomainEventType.APPOINTMENT_CANCELLED, saved.getId(), actor, payload(saved));
        return view(saved);
    }

    /** Marks a confirmed appointment as a no-show once the visit has started. */
    @Transactional
    public AppointmentView markNoShow(UUID id, EventActor actor) {
        Appointment appointment = locked(id);
        appointment.markNoShow(clock.instant());
        Appointment saved = flush(appointment);
        recorder.record(DomainEventType.APPOINTMENT_NO_SHOW, saved.getId(), actor, payload(saved));
        return view(saved);
    }

    private Appointment locked(UUID id) {
        return appointments.findByIdForUpdate(id)
                .orElseThrow(() -> new BookingException(Reason.APPOINTMENT_NOT_FOUND, "appointment not found"));
    }

    private Appointment flush(Appointment appointment) {
        try {
            return appointments.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException e) {
            if (OverlapViolations.isOverlap(e)) {
                throw new BookingException(Reason.TIME_TAKEN, "time is already booked", e);
            }
            throw e;
        }
    }

    private static Map<String, Object> payload(Appointment a) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("client_id", a.getClient().getId().toString());
        payload.put("service_id", a.getService().getId().toString());
        payload.put("start", a.getPeriod().start().toString());
        payload.put("end", a.getPeriod().end().toString());
        return payload;
    }

    private AppointmentView view(Appointment a) {
        return new AppointmentView(
                a.getId(),
                a.getClient().getId(),
                a.getService().getId(),
                a.getPeriod(),
                a.getStatus(),
                a.getSource(),
                settings.get().getTimeZone());
    }
}
