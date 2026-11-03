FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
RUN --mount=type=cache,id=identity-service-maven,target=/root/.m2,sharing=locked \
    set -eu; \
    for attempt in 1 2 3 4; do \
        if mvn -B -U -Dmaven.artifact.threads=1 dependency:go-offline; then break; fi; \
        if [ "$attempt" -eq 4 ]; then exit 1; fi; \
        case "$attempt" in 1) delay=15 ;; 2) delay=30 ;; *) delay=60 ;; esac; \
        echo "Dependency download failed; retrying in $delay seconds ($attempt/4)"; \
        sleep "$delay"; \
    done
COPY src ./src
RUN --mount=type=cache,id=identity-service-maven,target=/root/.m2,sharing=locked \
    mvn -B package

FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar

EXPOSE 8087
ENTRYPOINT ["java", "-jar", "app.jar"]
