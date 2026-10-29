package com.ticketing.platform.notification.infrastructure.qr;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Renders a ticket's signed QR payload string as a PNG, purely for embedding in the
 * ticket-issued email - the check-in app itself never goes through this class, it reads the raw
 * {@code qrPayload} string straight from the ticket-issued event/API response and renders its own
 * on-screen QR code. */
@Component
public class QrImageRenderer {

    private static final int SIZE_PX = 300;

    public byte[] renderPng(String qrPayload) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(qrPayload, BarcodeFormat.QR_CODE, SIZE_PX, SIZE_PX);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (WriterException | IOException e) {
            throw new IllegalStateException("Failed to render QR code image", e);
        }
    }
}
