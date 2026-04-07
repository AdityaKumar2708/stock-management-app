package com.stockapp.model;

import jakarta.persistence.*;

@Entity
public class AppSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String shopName;

    @Column(length = 1500)
    private String description;

    @Column(nullable = false)
    private boolean darkMode;

    @Column(nullable = false)
    private boolean multiAccountEnabled;

    public Long getId() {
        return id;
    }

    public String getShopName() {
        return shopName;
    }

    public void setShopName(String shopName) {
        this.shopName = shopName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isDarkMode() {
        return darkMode;
    }

    public void setDarkMode(boolean darkMode) {
        this.darkMode = darkMode;
    }

    public boolean isMultiAccountEnabled() {
        return multiAccountEnabled;
    }

    public void setMultiAccountEnabled(boolean multiAccountEnabled) {
        this.multiAccountEnabled = multiAccountEnabled;
    }
}
