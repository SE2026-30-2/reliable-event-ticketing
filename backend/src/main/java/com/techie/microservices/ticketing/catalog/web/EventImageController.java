package com.techie.microservices.ticketing.catalog.web;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EventImageController {
    private final JdbcTemplate jdbc;

    @PostMapping(value = "/api/manage/event-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh phải có dung lượng từ 1 byte đến 5 MB.");
        }
        byte[] data = file.getBytes();
        String type;
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IOException();
            var reader = readers.next();
            try {
                reader.setInput(input);
                String format = reader.getFormatName();
                if (!(format.equalsIgnoreCase("png") || format.equalsIgnoreCase("jpeg")) ||
                        (long) reader.getWidth(0) * reader.getHeight(0) > 20_000_000) throw new IOException();
                if (reader.read(0) == null) throw new IOException();
                type = format.equalsIgnoreCase("png") ? "image/png" : "image/jpeg";
            } finally { reader.dispose(); }
        } catch (IOException | RuntimeException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ chấp nhận ảnh JPG/PNG hợp lệ, tối đa 20 triệu điểm ảnh.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO event_images(image_id, content_type, content) VALUES (?, ?, ?)", id, type, data);
        return Map.of("url", "/api/event-images/" + id);
    }

    @GetMapping("/api/event-images/{id}")
    public ResponseEntity<byte[]> image(@PathVariable UUID id) {
        return jdbc.query("SELECT content_type, content FROM event_images WHERE image_id = ?", (rs, row) ->
                ResponseEntity.ok().contentType(MediaType.parseMediaType(rs.getString(1)))
                        .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic())
                        .header("X-Content-Type-Options", "nosniff").body(rs.getBytes(2)), id)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
