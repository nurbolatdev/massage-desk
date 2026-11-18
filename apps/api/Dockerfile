# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-noble AS build
WORKDIR /build

# Download dependencies in a separate layer so source edits reuse the Maven cache.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B -q dependency:go-offline

# Skip tests inside the image build: integration tests need Docker (Testcontainers) and run in CI.
COPY src src
RUN ./mvnw -B -q -Dmaven.test.skip=true package

# Extract Spring Boot layers from infrequent (dependencies) to frequent (application).
RUN cp target/*.jar application.jar \
    && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

FROM eclipse-temurin:21-jre-noble

# Run as a fixed non-root UID so the process cannot modify container files.
RUN useradd --system --no-create-home --uid 10001 app

WORKDIR /app

COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./

USER 10001

# Cap heap at 70% of container RAM to leave room for metaspace/threads and restart fast on OOM.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# Use exec form so SIGTERM reaches the JVM directly for graceful shutdown.
ENTRYPOINT ["java", "-jar", "application.jar"]
