package com.ticketing.identity.web.error;

import com.ticketing.identity.domain.exception.AccountLockedException;
import com.ticketing.identity.domain.exception.EmailAlreadyRegisteredException;
import com.ticketing.identity.domain.exception.InvalidCredentialsException;
import com.ticketing.identity.domain.exception.InvalidTokenException;
import com.ticketing.identity.domain.exception.UserNotFoundException;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import lombok.extern.slf4j.Slf4j;

/**
 * Central mapping from exceptions to HTTP responses so failures never leak out as an unhandled
 * 500, using this service's own {@code {message, details}} ErrorResponse shape (see its Javadoc
 * for why it differs from every other service's convention).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleEmailAlreadyRegistered(EmailAlreadyRegisteredException ex) {
        log.warn("Registration rejected: {}", ex.getMessage());
        return ErrorResponse.of(ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ErrorResponse handleInvalidCredentials(InvalidCredentialsException ex) {
        log.warn("Login rejected: {}", ex.getMessage());
        return ErrorResponse.of(ex.getMessage());
    }

    @ExceptionHandler(AccountLockedException.class)
    @ResponseStatus(HttpStatus.LOCKED)
    public ErrorResponse handleAccountLocked(AccountLockedException ex) {
        log.warn("Login rejected (locked account): {}", ex.getMessage());
        return ErrorResponse.of(ex.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleUserNotFound(UserNotFoundException ex) {
        log.warn("User not found: {}", ex.getMessage());
        return ErrorResponse.of(ex.getMessage());
    }

    @ExceptionHandler(InvalidTokenException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleInvalidToken(InvalidTokenException ex) {
        log.warn("Token rejected: {}", ex.getMessage());
        return ErrorResponse.of(ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidationException(MethodArgumentNotValidException ex) {
        List<String> details = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.toList());
        log.warn("Request validation failed: {}", details);
        return ErrorResponse.of("Validation failed", details);
    }
}
