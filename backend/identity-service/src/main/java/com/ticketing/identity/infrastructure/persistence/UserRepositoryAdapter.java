package com.ticketing.identity.infrastructure.persistence;

import com.ticketing.identity.application.port.UserRepositoryPort;
import com.ticketing.identity.domain.model.User;
import com.ticketing.identity.domain.model.UserStatus;

import java.util.HashSet;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepositoryPort {

    private final SpringDataUserJpaRepository jpaRepository;

    @Override
    public User save(User user) {
        UserEntity saved = jpaRepository.save(toEntity(user));
        return toDomain(saved);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return jpaRepository.findByEmailIgnoreCase(email).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return jpaRepository.existsByEmailIgnoreCase(email);
    }

    @Override
    public Page<User> findAll(Pageable pageable) {
        return jpaRepository.findAll(pageable).map(this::toDomain);
    }

    private UserEntity toEntity(User user) {
        return UserEntity.builder()
                .id(user.getId())
                .email(user.getEmail())
                .passwordHash(user.getPasswordHash())
                .fullName(user.getFullName())
                .roles(new HashSet<>(user.getRoles()))
                .status(user.getStatus())
                .failedLoginAttempts(user.getFailedLoginAttempts())
                .emailVerified(user.isEmailVerified())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    private User toDomain(UserEntity entity) {
        return User.builder()
                .id(entity.getId())
                .email(entity.getEmail())
                .passwordHash(entity.getPasswordHash())
                .fullName(entity.getFullName())
                .roles(new HashSet<>(entity.getRoles()))
                .status(entity.getStatus() != null ? entity.getStatus() : UserStatus.ACTIVE)
                .failedLoginAttempts(entity.getFailedLoginAttempts())
                .emailVerified(entity.isEmailVerified())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
