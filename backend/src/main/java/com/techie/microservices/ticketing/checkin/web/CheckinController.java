package com.techie.microservices.ticketing.checkin.web;

import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinCommand;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinUseCase;
import com.techie.microservices.ticketing.checkin.web.dto.CheckinResultResponse;
import com.techie.microservices.ticketing.checkin.web.dto.SubmitCheckinRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public at the Spring Security layer (same trust boundary as reservation/payment - see
 * SecurityConfig): authentication here is the {@code X-Device-Key} header, a symmetric device
 * credential, not a user JWT - a scanning device is equipment, not a user-service account. A
 * missing/unrecognized/revoked key is never an HTTP 401 - it is a normal, audited
 * {@code CheckinOutcome} in the response body, same as every other reason a scan might not be
 * accepted (see SubmitCheckinApplicationService). This is deliberate: the check-in app always
 * gets a structured answer it can show the operator, not a generic auth failure.
 */
@RestController
@RequiredArgsConstructor
@Validated
public class CheckinController {

    private static final String DEVICE_KEY_HEADER = "X-Device-Key";

    private final SubmitCheckinUseCase submitCheckinUseCase;

    @PostMapping("/api/checkin")
    public CheckinResultResponse submitCheckin(@RequestHeader(value = DEVICE_KEY_HEADER, required = false) String deviceKey,
                                                @Valid @RequestBody SubmitCheckinRequest request) {
        var record = submitCheckinUseCase.submitCheckin(
                new SubmitCheckinCommand(deviceKey, request.qrPayload(), request.idempotencyKey(), request.clientCheckinAt()));
        return CheckinResultResponse.from(record);
    }

    /** For the offline-queue flush: a device that was unreachable submits every attempt it
     * accumulated in one call. Each item resolves to its own outcome, in request order - one bad
     * item never prevents the rest of the batch from being recorded. */
    @PostMapping("/api/checkin/batch")
    public List<CheckinResultResponse> submitCheckinBatch(
            @RequestHeader(value = DEVICE_KEY_HEADER, required = false) String deviceKey,
            @Valid @RequestBody @NotEmpty @Size(max = 500) List<SubmitCheckinRequest> requests) {
        List<SubmitCheckinCommand> commands = requests.stream()
                .map(r -> new SubmitCheckinCommand(deviceKey, r.qrPayload(), r.idempotencyKey(), r.clientCheckinAt()))
                .toList();
        return submitCheckinUseCase.submitCheckinBatch(commands).stream()
                .map(CheckinResultResponse::from)
                .toList();
    }
}
