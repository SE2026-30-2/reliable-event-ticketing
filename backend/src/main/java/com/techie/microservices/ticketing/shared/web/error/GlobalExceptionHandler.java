package com.techie.microservices.ticketing.shared.web.error;

import com.techie.microservices.ticketing.catalog.domain.exception.EmailNotVerifiedException;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponAlreadyExistsException;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistEntryNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistException;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotTransferableException;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotOpenException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidTicketStatusTransitionException;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotResendableException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.exception.TooManyActiveReservationsException;
import com.techie.microservices.ticketing.checkin.domain.exception.DeviceNotFoundException;
import com.techie.microservices.ticketing.payment.domain.exception.ForceOutcomeNotAllowedException;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotRefundableException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Maps domain/validation exceptions to HTTP status codes.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler({WaitlistEntryNotFoundException.class, CouponNotFoundException.class, EventNotFoundException.class, TicketTypeNotFoundException.class, TicketNotFoundException.class,
            DeviceNotFoundException.class, ReservationNotFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(RuntimeException ex) {
        log.warn("Not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(HttpStatus.NOT_FOUND, ex.getMessage()));
    }

    @ExceptionHandler(TicketTypeSoldOutException.class)
    public ResponseEntity<ErrorResponse> handleSoldOut(TicketTypeSoldOutException ex) {
        log.warn("Sold out: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(TooManyActiveReservationsException.class)
    public ResponseEntity<ErrorResponse> handleTooManyReservations(TooManyActiveReservationsException ex) {
        log.warn("Reservation cap hit: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(ErrorResponse.of(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage()));
    }

    @ExceptionHandler(TicketNotResendableException.class)
    public ResponseEntity<ErrorResponse> handleNotResendable(TicketNotResendableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(ReservationNotPayableException.class)
    public ResponseEntity<ErrorResponse> handleNotPayable(ReservationNotPayableException ex) {
        log.warn("Reservation not payable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(WaitlistException.class)
    public ResponseEntity<ErrorResponse> handleWaitlist(WaitlistException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(InvalidCouponException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCoupon(InvalidCouponException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(CouponAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleCouponExists(CouponAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(TicketNotTransferableException.class)
    public ResponseEntity<ErrorResponse> handleNotTransferable(TicketNotTransferableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleEmailNotVerified(EmailNotVerifiedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of(HttpStatus.FORBIDDEN, ex.getMessage()));
    }

    @ExceptionHandler(ManagementForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleManagementForbidden(ManagementForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of(HttpStatus.FORBIDDEN, ex.getMessage()));
    }

    @ExceptionHandler({EventNotOpenException.class, InvalidEventChangeException.class})
    public ResponseEntity<ErrorResponse> handleEventRules(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(PaymentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handlePaymentNotFound(PaymentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of(HttpStatus.NOT_FOUND, ex.getMessage()));
    }

    @ExceptionHandler(PaymentNotRefundableException.class)
    public ResponseEntity<ErrorResponse> handleNotRefundable(PaymentNotRefundableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(ForceOutcomeNotAllowedException.class)
    public ResponseEntity<ErrorResponse> handleForceOutcome(ForceOutcomeNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(InvalidTicketStatusTransitionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTransition(InvalidTicketStatusTransitionException ex) {
        log.warn("Invalid status transition: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST, message));
    }

    /** Method-level (@Validated) parameter constraints - e.g. CheckinController's batch size
     * limit - land here instead of MethodArgumentNotValidException, which only covers @Valid
     * on a single @RequestBody object. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(violation -> violation.getMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST, message));
    }
}
