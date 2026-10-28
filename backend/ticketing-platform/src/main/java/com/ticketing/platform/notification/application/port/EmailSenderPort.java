package com.ticketing.platform.notification.application.port;

/** Output port for sending an email notification, implemented by a JavaMailSender-backed adapter. */
public interface EmailSenderPort {

    void send(String to, String subject, String body);

    /** {@code htmlBody} must itself contain {@code <img src="cid:" + imageContentId + "">"} where
     * the image should appear - this method only attaches {@code imageBytes} under that content
     * id, it does not rewrite the body. Used for the ticket-issued email's embedded QR code. */
    void sendWithInlineImage(String to, String subject, String htmlBody, byte[] imageBytes, String imageContentId);
}
