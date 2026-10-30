package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.AcceptResult;
import com.techie.microservices.ticketing.checkin.application.port.CheckinRecordRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinCommand;
import com.techie.microservices.ticketing.checkin.application.port.VoidedTicketCachePort;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import com.techie.microservices.ticketing.checkin.infrastructure.security.ApiKeyHasher;
import com.techie.microservices.ticketing.checkin.infrastructure.security.TicketQrVerifier;
import com.techie.microservices.ticketing.checkin.infrastructure.security.VerifiedTicketClaims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SubmitCheckinApplicationServiceTest {

    @Mock
    private CheckinRecordRepositoryPort checkinRecordRepositoryPort;
    @Mock
    private DeviceRepositoryPort deviceRepositoryPort;
    @Mock
    private VoidedTicketCachePort voidedTicketCachePort;
    @Mock
    private TicketQrVerifier ticketQrVerifier;
    @Mock
    private ApiKeyHasher apiKeyHasher;

    private SubmitCheckinApplicationService service;

    private final UUID ticketId = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private final String deviceKey = "plaintext-key";
    private final String keyHash = "hashed-key";

    @BeforeEach
    void setUp() {
        service = new SubmitCheckinApplicationService(
                checkinRecordRepositoryPort, deviceRepositoryPort, voidedTicketCachePort, ticketQrVerifier, apiKeyHasher);
        when(apiKeyHasher.hash(deviceKey)).thenReturn(keyHash);
    }

    private SubmitCheckinCommand command(String qrPayload) {
        return new SubmitCheckinCommand(deviceKey, qrPayload, UUID.randomUUID(), Instant.now());
    }

    private CheckinDevice activeDevice() {
        return CheckinDevice.builder().deviceId(deviceId).label("Gate A").status(DeviceStatus.ACTIVE).apiKeyHash(keyHash).build();
    }

    private VerifiedTicketClaims validClaims() {
        long now = Instant.now().getEpochSecond();
        return new VerifiedTicketClaims(ticketId, eventId, UUID.randomUUID(), now - 3600, now + 3600, now - 7200);
    }

    @Test
    void returnsReplayWithoutReprocessingWhenIdempotencyKeyAlreadySeen() {
        SubmitCheckinCommand cmd = command("qr");
        CheckinRecord existing = CheckinRecord.builder().outcome(CheckinOutcome.ACCEPTED).build();
        when(checkinRecordRepositoryPort.findByIdempotencyKey(cmd.idempotencyKey())).thenReturn(Optional.of(existing));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result).isSameAs(existing);
        verify(deviceRepositoryPort, never()).findByApiKeyHash(anyString());
        verify(ticketQrVerifier, never()).verify(anyString());
    }

    @Test
    void acceptsAFreshValidScanFromAnActiveDevice() {
        SubmitCheckinCommand cmd = command("qr");
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(checkinRecordRepositoryPort.tryAccept(any(), anyInt())).thenReturn(AcceptResult.ACCEPTED);

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.ACCEPTED);
        assertThat(result.getTicketId()).isEqualTo(ticketId);
        assertThat(result.getEventId()).isEqualTo(eventId);
        assertThat(result.getDeviceId()).isEqualTo(deviceId);
        verify(checkinRecordRepositoryPort, never()).save(any());
    }

    @Test
    void recordsDuplicateWhenTicketAlreadyAccepted() {
        SubmitCheckinCommand cmd = command("qr");
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(checkinRecordRepositoryPort.tryAccept(any(), anyInt())).thenReturn(AcceptResult.ALL_ENTRIES_USED);
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.DUPLICATE);
    }

    @Test
    void passesTheSignedMaxEntriesToTheAtomicInsertAndExplainsExhaustion() {
        long now = Instant.now().getEpochSecond();
        VerifiedTicketClaims twoDayPass = new VerifiedTicketClaims(ticketId, eventId, UUID.randomUUID(), now - 3600, now + 3600, now - 7200, 2);
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(twoDayPass));
        when(checkinRecordRepositoryPort.tryAccept(any(), org.mockito.ArgumentMatchers.eq(2))).thenReturn(AcceptResult.ALL_ENTRIES_USED);
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(command("qr"));

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.DUPLICATE);
        assertThat(result.getDetail()).contains("All 2 entries");
    }

    @Test
    void aTicketVoidedBetweenTheCacheCheckAndTheInsertIsReportedAsVoidedNotDuplicate() {
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(checkinRecordRepositoryPort.tryAccept(any(), anyInt())).thenReturn(AcceptResult.VOIDED);
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.submitCheckin(command("qr")).getOutcome()).isEqualTo(CheckinOutcome.TICKET_VOIDED);
    }

    @Test
    void rejectsWhenDeviceKeyMatchesNoDevice() {
        SubmitCheckinCommand cmd = command("qr");
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.empty());
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.DEVICE_NOT_FOUND);
        assertThat(result.getDeviceId()).isNull();
    }

    @Test
    void rejectsWhenDeviceIsRevokedEvenIfQrIsGenuine() {
        SubmitCheckinCommand cmd = command("qr");
        CheckinDevice revoked = CheckinDevice.builder().deviceId(deviceId).status(DeviceStatus.REVOKED)
                .apiKeyHash(keyHash).revokedAt(Instant.now()).build();
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(revoked));
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.DEVICE_REVOKED);
        verify(checkinRecordRepositoryPort, never()).tryAccept(any(), anyInt());
    }

    @Test
    void rejectsAnUnverifiableQrPayload() {
        SubmitCheckinCommand cmd = command("garbage");
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("garbage")).thenReturn(Optional.empty());
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.INVALID_SIGNATURE);
        assertThat(result.getTicketId()).isNull();
    }

    @Test
    void rejectsATicketOutsideItsValidityWindow() {
        SubmitCheckinCommand cmd = command("qr");
        long now = Instant.now().getEpochSecond();
        VerifiedTicketClaims expiredClaims = new VerifiedTicketClaims(ticketId, eventId, UUID.randomUUID(), now - 7200, now - 3600, now - 10000);
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(expiredClaims));
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.EXPIRED_WINDOW);
    }

    @Test
    void rejectsAVoidedTicketEvenWithAGenuineInWindowSignature() {
        SubmitCheckinCommand cmd = command("qr");
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(activeDevice()));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(voidedTicketCachePort.isVoided(ticketId)).thenReturn(true);
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.TICKET_VOIDED);
        verify(checkinRecordRepositoryPort, never()).tryAccept(any(), anyInt());
    }

    @Test
    void rejectsADeviceRegisteredForADifferentEvent() {
        SubmitCheckinCommand cmd = command("qr");
        CheckinDevice otherEventDevice = CheckinDevice.builder().deviceId(deviceId).status(DeviceStatus.ACTIVE)
                .apiKeyHash(keyHash).eventId(UUID.randomUUID()).build();
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(otherEventDevice));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(checkinRecordRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinRecord result = service.submitCheckin(cmd);

        assertThat(result.getOutcome()).isEqualTo(CheckinOutcome.WRONG_EVENT);
        verify(checkinRecordRepositoryPort, never()).tryAccept(any(), anyInt());
    }

    @Test
    void acceptsADeviceRegisteredForTheTicketsOwnEvent() {
        SubmitCheckinCommand cmd = command("qr");
        CheckinDevice sameEventDevice = CheckinDevice.builder().deviceId(deviceId).status(DeviceStatus.ACTIVE)
                .apiKeyHash(keyHash).eventId(eventId).build();
        when(checkinRecordRepositoryPort.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(deviceRepositoryPort.findByApiKeyHash(keyHash)).thenReturn(Optional.of(sameEventDevice));
        when(ticketQrVerifier.verify("qr")).thenReturn(Optional.of(validClaims()));
        when(checkinRecordRepositoryPort.tryAccept(any(), anyInt())).thenReturn(AcceptResult.ACCEPTED);

        assertThat(service.submitCheckin(cmd).getOutcome()).isEqualTo(CheckinOutcome.ACCEPTED);
    }
}
