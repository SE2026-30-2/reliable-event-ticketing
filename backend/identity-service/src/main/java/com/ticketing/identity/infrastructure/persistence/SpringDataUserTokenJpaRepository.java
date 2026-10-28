package com.ticketing.identity.infrastructure.persistence;

import com.ticketing.identity.domain.model.UserTokenType;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpringDataUserTokenJpaRepository extends JpaRepository<UserTokenEntity, UUID> {

    Optional<UserTokenEntity> findByTokenHashAndType(String tokenHash, UserTokenType type);

    @Modifying
    @Query("UPDATE UserTokenEntity t SET t.usedAt = :now WHERE t.userId = :userId AND t.type = :type AND t.usedAt IS NULL")
    void invalidateAllForUser(@Param("userId") UUID userId, @Param("type") UserTokenType type, @Param("now") Instant now);
}
