package com.stockapp.config;

import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

@Configuration
public class DatabaseConfig {

    private final Environment environment;

    public DatabaseConfig(Environment environment) {
        this.environment = environment;
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        return DataSourceBuilder.create()
                .driverClassName("org.postgresql.Driver")
                .url(resolveJdbcUrl())
                .username(resolveUsername())
                .password(resolvePassword())
                .build();
    }

    private String resolveJdbcUrl() {
        String explicitJdbc = firstNonBlank(
                environment.getProperty("SPRING_DATASOURCE_URL"),
                environment.getProperty("DATABASE_URL")
        );
        if (hasText(explicitJdbc)) {
            return normalizeJdbcUrl(explicitJdbc);
        }

        String host = firstNonBlank(
                environment.getProperty("PGHOST"),
                environment.getProperty("DB_HOST"),
                environment.getProperty("DATABASE_HOST"),
                "localhost"
        );
        String port = firstNonBlank(
                environment.getProperty("PGPORT"),
                environment.getProperty("DB_PORT"),
                environment.getProperty("DATABASE_PORT"),
                "5432"
        );
        String database = firstNonBlank(
                environment.getProperty("PGDATABASE"),
                environment.getProperty("DB_NAME"),
                environment.getProperty("DATABASE_NAME"),
                "stock_management_db"
        );

        return "jdbc:postgresql://" + host + ":" + port + "/" + database;
    }

    private String resolveUsername() {
        return firstNonBlank(
                environment.getProperty("SPRING_DATASOURCE_USERNAME"),
                environment.getProperty("PGUSER"),
                environment.getProperty("DB_USERNAME"),
                environment.getProperty("DATABASE_USERNAME"),
                "postgres"
        );
    }

    private String resolvePassword() {
        return firstNonBlank(
                environment.getProperty("SPRING_DATASOURCE_PASSWORD"),
                environment.getProperty("PGPASSWORD"),
                environment.getProperty("DB_PASSWORD"),
                environment.getProperty("DATABASE_PASSWORD"),
                "postgres"
        );
    }

    private String normalizeJdbcUrl(String value) {
        if (value.startsWith("jdbc:")) {
            return value;
        }
        if (value.startsWith("postgresql://")) {
            return "jdbc:" + value;
        }
        if (value.startsWith("postgres://")) {
            return "jdbc:postgresql://" + value.substring("postgres://".length());
        }
        return value;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }
}
