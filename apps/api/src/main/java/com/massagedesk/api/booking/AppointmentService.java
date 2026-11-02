package com.massagedesk.api.booking;

import com.massagedesk.api.booking.BookingException.Reason;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
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

    public AppointmentService(
            AppointmentRepository appointments,
            ClientRepository clients,
            MassageServiceRepository services,
            SlotService slotService,
            SettingsRepository settings,
            Clock clock) {
        this.appointments = appointments;
        this.clients = clients;
        this.services = services;
        this.slotService = slotService;
        this.settings = settings;
        this.clock = clock;
    }

    /** Books the service for the client; the end is the start plus the service length. */
    @Transactional
    public AppointmentView create(UUID clientId, UUID serviceId, Instant start, AppointmentSource source) {
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
        return view(saved);
    }

    /** Moves a confirmed appointment, keeping its booked length. */
    @Transactional
    public AppointmentView reschedule(UUID id, Instant start) {
        Appointment appointment = locked(id);
        appointment.requireConfirmed();
        TimeRange old = appointment.getPeriod();
        TimeRange period = new TimeRange(start, start.plus(Duration.between(old.start(), old.end())));
        if (!slotService.fitsSchedule(period)) {
            throw new BookingException(
                    Reason.OUTSIDE_SCHEDULE, "time is outside working hours, in time off or in the past");
        }
        appointment.reschedule(period);
        return view(flush(appointment));
    }

    /** Cancels a confirmed appointment. */
    @Transactional
    public AppointmentView cancel(UUID id) {
        Appointment appointment = locked(id);
        appointment.cancel();
        return view(flush(appointment));
    }

    /** Marks a confirmed appointment as a no-show once the visit has started. */
    @Transactional
    public AppointmentView markNoShow(UUID id) {
        Appointment appointment = locked(id);
        appointment.markNoShow(clock.instant());
        return view(flush(appointment));
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
