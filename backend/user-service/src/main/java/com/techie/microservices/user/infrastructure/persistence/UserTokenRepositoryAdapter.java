package com.techie.microservices.user.infrastructure.persistence;

import com.techie.microservices.user.application.port.UserTokenRepositoryPort;
import com.techie.microservices.user.domain.model.UserToken;
import com.techie.microservices.user.domain.model.UserTokenType;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class UserTokenRepositoryAdapter implements UserTokenRepositoryPort {

    private final SpringDataUserTokenJpaRepository jpaRepository;

    @Override
    public UserToken save(UserToken token) {
        UserTokenEntity saved = jpaRepository.save(toEntity(token));
        return toDomain(saved);
    }

    @Override
    public Optional<UserToken> findByTokenHashAndType(String tokenHash, UserTokenType type) {
        return jpaRepository.findByTokenHashAndType(tokenHash, type).map(this::toDomain);
    }

    @Override
    @Transactional
    public void invalidateAllForUser(UUID userId, UserTokenType type) {
        jpaRepository.invalidateAllForUser(userId, type, Instant.now());
    }

    private UserTokenEntity toEntity(UserToken token) {
        return UserTokenEntity.builder()
                .id(token.getId())
                .userId(token.getUserId())
                .tokenHash(token.getTokenHash())
                .type(token.getType())
                .expiresAt(token.getExpiresAt())
                .usedAt(token.getUsedAt())
                .createdAt(token.getCreatedAt())
                .build();
    }

    private UserToken toDomain(UserTokenEntity entity) {
        return UserToken.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .tokenHash(entity.getTokenHash())
                .type(entity.getType())
                .expiresAt(entity.getExpiresAt())
                .usedAt(entity.getUsedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
