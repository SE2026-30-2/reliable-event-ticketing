# Use a base image with Java 21 (matching your pom.xml)
FROM eclipse-temurin:21-jre-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy the built Spring Boot application JAR file into the container
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar

# Container-internal port; docker-compose maps this via SERVER_PORT=8080 env override
# (ticketing-platform's own application.properties default server.port is 8091 for host-local runs)
EXPOSE 8080

# Command to run the application when the container starts
ENTRYPOINT ["java", "-jar", "app.jar"]
