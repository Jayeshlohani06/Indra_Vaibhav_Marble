
FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /app

COPY backend/pom.xml mvnw ./
COPY backend/.mvn .mvn

RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B

COPY backend/src src
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:17-jre

WORKDIR /app

RUN useradd --system --create-home appuser

COPY --from=build /app/target/*.jar app.jar

RUN chown appuser:appuser /app/app.jar

USER appuser

ENV JAVA_OPTS=""

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar --server.port=${PORT:-8080}"]
