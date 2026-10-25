package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class EventRepositoryAdapter implements EventRepositoryPort {

    private final SpringDataEventJpaRepository jpaRepository;

    @Override
    public Event save(Event event) {
        return toDomain(jpaRepository.save(toEntity(event)));
    }

    @Override
    public Optional<Event> findByEventId(UUID eventId) {
        return jpaRepository.findByEventId(eventId).map(EventRepositoryAdapter::toDomain);
    }

    @Override
    public List<Event> findAll() {
        return jpaRepository.findAll().stream().map(EventRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<Event> searchPublic(String query, Instant now, int limit) {
        String like = "%" + (query == null ? "" : query.trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")) + "%";
        return jpaRepository.searchPublic(now, like, PageRequest.of(0, limit)).stream().map(EventRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<Event> findByOrganizer(String organizerId) {
        return jpaRepository.findByOrganizerIdOrderByStartsAtDesc(organizerId).stream().map(EventRepositoryAdapter::toDomain).toList();
    }

    private static EventEntity toEntity(Event event) {
        return EventEntity.builder()
                .id(event.getId())
                .eventId(event.getEventId())
                .name(event.getName())
                .venue(event.getVenue())
                .startsAt(event.getStartsAt())
                .endsAt(event.getEndsAt())
                .status(event.getStatus().name())
                .createdAt(event.getCreatedAt())
                .organizerId(event.getOrganizerId())
                .description(event.getDescription())
                .bannerUrl(event.getBannerUrl())
                .build();
    }

    private static Event toDomain(EventEntity entity) {
        return Event.builder()
                .id(entity.getId())
                .eventId(entity.getEventId())
                .name(entity.getName())
                .venue(entity.getVenue())
                .startsAt(entity.getStartsAt())
                .endsAt(entity.getEndsAt())
                .status(EventStatus.valueOf(entity.getStatus()))
                .createdAt(entity.getCreatedAt())
                .organizerId(entity.getOrganizerId())
                .description(entity.getDescription())
                .bannerUrl(entity.getBannerUrl())
                .build();
    }
}
