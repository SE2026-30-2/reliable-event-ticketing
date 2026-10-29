package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;

import java.util.List;

public interface SubmitCheckinUseCase {
    /** Never throws for a business outcome (invalid signature, duplicate, voided, bad device,
     * ...) - every one of those is a normal {@link CheckinRecord} result, not an exception. */
    CheckinRecord submitCheckin(SubmitCheckinCommand command);

    /** Each item is resolved independently (its own outcome, its own persisted record) so one bad
     * item in a batch can never affect another - see the submission-flush offline queue this
     * exists for. */
    List<CheckinRecord> submitCheckinBatch(List<SubmitCheckinCommand> commands);
}
