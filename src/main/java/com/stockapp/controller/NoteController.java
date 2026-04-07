package com.stockapp.controller;

import com.stockapp.model.Note;
import com.stockapp.repository.NoteRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteRepository noteRepository;

    public NoteController(NoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }

    @GetMapping
    public List<Note> list() {
        List<Note> notes = noteRepository.findAll();
        notes.sort(Comparator.comparing(Note::getUpdatedAt).reversed());
        return notes;
    }

    @PostMapping
    public ResponseEntity<Note> create(@Valid @RequestBody Note payload) {
        payload.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(noteRepository.save(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody Note payload) {
        var existingOpt = noteRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Note not found");
        }

        Note existing = existingOpt.get();
        existing.setTitle(payload.getTitle());
        existing.setContent(payload.getContent());
        existing.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(noteRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!noteRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Note not found");
        }
        noteRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
