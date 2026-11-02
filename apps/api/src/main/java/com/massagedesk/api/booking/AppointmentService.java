package com.massagedesk.api.booking;

import com.massagedesk.api.booking.BookingException.Reason;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.settings.SettingsRepository;
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

    public AppointmentService(
            AppointmentRepository appointments,
            ClientRepository clients,
            MassageServiceRepository services,
            SlotService slotService,
            SettingsRepository settings) {
        this.appointments = appointments;
        this.clients = clients;
        this.services = services;
        this.slotService = slotService;
        this.settings = settings;
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
