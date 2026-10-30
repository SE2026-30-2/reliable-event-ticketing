FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
RUN --mount=type=cache,id=ticketing-platform-maven,target=/root/.m2,sharing=locked \
    set -eu; \
    for attempt in 1 2 3; do \
        if mvn -B -U -Dmaven.artifact.threads=1 dependency:go-offline; then break; fi; \
        if [ "$attempt" -eq 3 ]; then exit 1; fi; \
        echo "Dependency download failed; retrying in 5 seconds ($attempt/3)"; \
        sleep 5; \
    done
COPY src ./src
RUN --mount=type=cache,id=ticketing-platform-maven,target=/root/.m2,sharing=locked \
    mvn -B package

FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
