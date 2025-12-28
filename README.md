# Ravenfall Realm

A D&D-inspired RPG powered by Ollama.

## Setup

### Prerequisites
- [Ollama](https://ollama.com/) running on localhost:11434.
- Model `gemma3:27b-it-qat` pulled (`ollama pull gemma3:27b-it-qat`).

### Installation
1. Install all dependencies (Server & Client):
   ```bash
   npm run install:all
   ```
   *Alternatively, you can install dependencies in `server` and `client` folders individually.*

## Running the Game

1. **Start the Realm**:
   In the root directory, run:
   ```bash
   npm start
   ```
   This command launches both the Backend (Port 3000) and Frontend (Port 5173).

2. Open `http://localhost:5173` in your browser.
