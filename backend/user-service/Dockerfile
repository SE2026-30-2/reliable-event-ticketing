# Use a base image with Java 21 (matching your pom.xml)
FROM eclipse-temurin:21-jre-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy the built Spring Boot application JAR file into the container
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar

# Expose the port the user service listens on inside the container - unlike the other services,
# this one's own server.port (8087) is not remapped to 8080; docker-compose maps 8087:8087.
EXPOSE 8087

# Command to run the application when the container starts
ENTRYPOINT ["java", "-jar", "app.jar"]
