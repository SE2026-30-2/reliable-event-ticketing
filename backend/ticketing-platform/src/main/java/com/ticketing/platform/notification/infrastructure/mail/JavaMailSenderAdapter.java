package com.ticketing.platform.notification.infrastructure.mail;

import com.ticketing.platform.notification.application.port.EmailSenderPort;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.mail.javamail.MimeMessagePreparator;
import org.springframework.stereotype.Component;

/** {@link EmailSenderPort} adapter backed by {@link JavaMailSender}, ported from
 * notification-service unchanged except for the added {@link #sendWithInlineImage} method (the
 * plain-text {@link #send} this service already had cannot carry an inline image - a {@code cid:}
 * reference only resolves inside a multipart/HTML message). */
@Component
@RequiredArgsConstructor
public class JavaMailSenderAdapter implements EmailSenderPort {

    private final JavaMailSender javaMailSender;

    @Value("${notification.mail.from}")
    private String fromAddress;

    @Override
    public void send(String to, String subject, String body) {
        MimeMessagePreparator messagePreparator = mimeMessage -> {
            MimeMessageHelper messageHelper = new MimeMessageHelper(mimeMessage);
            messageHelper.setFrom(fromAddress);
            messageHelper.setTo(to);
            messageHelper.setSubject(subject);
            messageHelper.setText(body);
        };
        javaMailSender.send(messagePreparator);
    }

    @Override
    public void sendWithInlineImage(String to, String subject, String htmlBody, byte[] imageBytes, String imageContentId) {
        MimeMessagePreparator messagePreparator = mimeMessage -> {
            MimeMessageHelper messageHelper = new MimeMessageHelper(mimeMessage, true);
            messageHelper.setFrom(fromAddress);
            messageHelper.setTo(to);
            messageHelper.setSubject(subject);
            messageHelper.setText(htmlBody, true);
            messageHelper.addInline(imageContentId, new ByteArrayResource(imageBytes), "image/png");
        };
        javaMailSender.send(messagePreparator);
    }
}
