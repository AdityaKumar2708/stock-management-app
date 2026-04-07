package com.stockapp.controller;

import com.stockapp.model.AppSetting;
import com.stockapp.repository.AppSettingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final AppSettingRepository appSettingRepository;

    public SettingsController(AppSettingRepository appSettingRepository) {
        this.appSettingRepository = appSettingRepository;
    }

    @GetMapping
    public AppSetting getSettings() {
        return getOrCreate();
    }

    @PutMapping
    public ResponseEntity<AppSetting> update(@RequestBody AppSetting payload) {
        AppSetting settings = getOrCreate();
        settings.setShopName(payload.getShopName());
        settings.setDescription(payload.getDescription());
        settings.setDarkMode(payload.isDarkMode());
        settings.setMultiAccountEnabled(payload.isMultiAccountEnabled());
        return ResponseEntity.ok(appSettingRepository.save(settings));
    }

    private AppSetting getOrCreate() {
        return appSettingRepository.findAll().stream().findFirst().orElseGet(() -> {
            AppSetting defaults = new AppSetting();
            defaults.setShopName("My Shop");
            defaults.setDescription("Stock and billing system");
            defaults.setDarkMode(false);
            defaults.setMultiAccountEnabled(false);
            return appSettingRepository.save(defaults);
        });
    }
}
