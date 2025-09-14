# Tests für RAG Prototype

Dieses Verzeichnis enthält alle Tests für das RAG Prototype System.

## Test-Dateien

### `test-config.js`
Testet das Laden der Konfiguration und prüft ob alle erforderlichen Umgebungsvariablen korrekt verarbeitet werden.

### `test-connection.js`
Prüft die Verbindung zur PostgreSQL-Datenbank über Docker und stellt sicher, dass die Datenbank bereit ist.

### `test-database.js`
Führt eine einfache SQL-Abfrage aus um die Funktionalität der Datenbank zu testen.

### `test-system.js`
Testet das komplette RAG-System inklusive Datenbankverbindung und Embeddings-System.

### `run-all-tests.js`
Test-Runner der alle Tests nacheinander ausführt und eine Zusammenfassung liefert.

## Verwendung

### Einzelne Tests ausführen
```bash
npm run test:config      # Nur Konfiguration testen
npm run test:connection  # Nur Datenbankverbindung testen
npm run test:db         # Nur Datenbankfunktionalität testen
npm run test:system     # Nur RAG-System testen
```

### Alle Tests ausführen
```bash
npm test               # Kurze Version
npm run test:all       # Explizite Version
```

## Voraussetzungen

- Docker muss laufen
- PostgreSQL Container muss gestartet sein (`npm run docker:up`)
- Node.js Module müssen installiert sein (`npm install`)

## Test-Ausgabe

Jeder Test gibt detaillierte Informationen über den aktuellen Status aus:
- 🧪 Test wird gestartet
- ✅ Test erfolgreich
- ❌ Test fehlgeschlagen mit Fehlermeldung

Der Test-Runner gibt am Ende eine Zusammenfassung aller Tests aus.
