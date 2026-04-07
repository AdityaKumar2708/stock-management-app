FROM eclipse-temurin:17-jdk

WORKDIR /app

COPY . .

RUN chmod +x gradlew
RUN ./gradlew clean build   # <-- IMPORTANT CHANGE

CMD ["java", "-jar", "build/libs/stock-management-app-0.0.1-SNAPSHOT.jar"]