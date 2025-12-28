const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { generateResponse, listModels } = require('./ollama');

const app = express();
const PORT = 3000;
const SAVES_DIR = path.join(__dirname, 'saves');

// Ensure saves directory exists
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

app.use(cors());
app.use(bodyParser.json());

// In-memory storage for game sessions
// Key: sessionId, Value: { character: {}, history: [], model: string }
const sessions = {};

const SYSTEM_PROMPT = `You are the Dungeon Master (DM) for a Dungeons and Dragons game. 
You will describe the world, non-player characters (NPCs), and events. 
The player will tell you their actions.

**IMPORTANT: DICE ROLLING**
You must NOT ask the player to roll dice. You must determine when a roll is needed (combat, ability checks, saving throws).
To perform a roll, you MUST output a special command in your response: \`[[ROLL: XdY+Z]]\`
- Example: \`[[ROLL: 1d20+3]]\` or \`[[ROLL: 2d6]]\`
- Stop your response immediately after the command.
- The system will roll the dice and provide you with the result in the next prompt.
- Use the provided result to narrate the outcome.

**General Rules:**
1. Describe the outcomes of the player's actions based on 5th Edition rules.
2. Keep descriptions vivid but concise.
3. Do not act for the player.
4. If a combat occurs, manage the initiative and turns using the ROLL commands.

Current Player Character:
`;

// Helper: Parse dice string (e.g. "1d20+5")
function parseDice(expression) {
    // Regex for XdY(+/-Z) matches
    const regex = /(\d+)d(\d+)(?:\s*([-+])\s*(\d+))?/i;
    const match = expression.match(regex);
    if (!match) return null;

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const op = match[3];
    const mod = match[4] ? parseInt(match[4]) : 0;

    return { count, sides, op, mod };
}

// Helper: Execute roll
function rollDice(diceObj) {
    let total = 0;
    const rolls = [];
    for (let i = 0; i < diceObj.count; i++) {
        const result = Math.floor(Math.random() * diceObj.sides) + 1;
        total += result;
        rolls.push(result);
    }

    if (diceObj.op === '+') total += diceObj.mod;
    if (diceObj.op === '-') total -= diceObj.mod;

    return { total, rolls, expression: `${diceObj.count}d${diceObj.sides}${diceObj.op ? diceObj.op + diceObj.mod : ''}` };
}

app.get('/api/models', async (req, res) => {
    const models = await listModels();
    res.json({ models });
});

app.post('/api/start', async (req, res) => {
    try {
        const { character, model } = req.body;
        const sessionId = Date.now().toString();

        const initialPrompt = `${SYSTEM_PROMPT} Name: ${character.name}, Race: ${character.race}, Class: ${character.class}. 
Stats: STR: ${character.stats.str}, DEX: ${character.stats.dex}, CON: ${character.stats.con}, INT: ${character.stats.int}, WIS: ${character.stats.wis}, CHA: ${character.stats.cha}.

The adventure begins. Describe the starting scene.`;

        // Use selected model, initial generation usually doesn't need rolls but we can support it if needed.
        // For simplicity, we assume start doesn't trigger a roll loop immediately, or we could refactor the loop logic to be reusable.
        // Let's assume start implies just description.
        const response = await generateResponse([{ role: 'system', content: initialPrompt }], model);

        sessions[sessionId] = {
            id: sessionId,
            character,
            model,
            history: [
                { role: 'system', content: initialPrompt },
                { role: 'assistant', content: response }
            ],
            lastSaved: null
        };

        res.json({ sessionId, message: response });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
});

app.post('/api/action', async (req, res) => {
    try {
        const { sessionId, action } = req.body;
        const session = sessions[sessionId];

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Add player action to history
        session.history.push({ role: 'user', content: action });

        let finalResponse = "";
        let steps = 0;
        const MAX_STEPS = 5; // Prevent infinite loops

        while (steps < MAX_STEPS) {
            steps++;
            console.log(`Step ${steps}: Generating response...`);

            // Generate response
            const responseText = await generateResponse(session.history, session.model);

            // Check for ROLL command
            const rollMatch = responseText.match(/\[\[ROLL:\s*(.*?)\]\]/);

            if (rollMatch) {
                const expression = rollMatch[1];
                console.log(`DM requested roll: ${expression}`);

                const diceData = parseDice(expression);
                if (diceData) {
                    const result = rollDice(diceData);
                    const systemMsg = `System: Rolled ${result.expression}. Result: ${result.total} (Dice: ${result.rolls.join(', ')})`;

                    console.log(systemMsg);

                    // Add the partial response (text before roll) if any?
                    // Usually LLM will output "I need to check... [[ROLL: ...]]"
                    // We can retain the preamble or just treat the whole block as the request.
                    // Ideally we append the response containing the roll request to history,
                    // but marked as assistant.

                    // Note: If we just append responseText, the user will see "[[ROLL...]]" in chat.
                    // Ideally we want to hide that from the user or format it.
                    // For now, let's append it. Frontend can handle it if we want.

                    session.history.push({ role: 'assistant', content: responseText });
                    session.history.push({ role: 'system', content: systemMsg }); // Result for LLM

                    // Loop continues, LLM sees its request and the system result
                    continue;
                } else {
                    console.error("Failed to parse dice expression");
                    // If parse fails, just return text to avoid loop
                    finalResponse = responseText;
                    session.history.push({ role: 'assistant', content: responseText });
                    break;
                }
            } else {
                // No roll, this is the final narrative
                finalResponse = responseText;
                session.history.push({ role: 'assistant', content: responseText });
                break;
            }
        }

        res.json({ message: finalResponse });
    } catch (error) {
        console.error('Error processing action:', error);
        res.status(500).json({ error: 'Failed to process action' });
    }
});

app.get('/api/state/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (session) {
        res.json(session);
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.post('/api/session/model', (req, res) => {
    const { sessionId, model } = req.body;
    const session = sessions[sessionId];
    if (session) {
        session.model = model;
        console.log(`Session ${sessionId} switched to model: ${model}`);
        res.json({ message: 'Model updated', model });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// --- SAVE / LOAD ENDPOINTS ---

app.post('/api/save', (req, res) => {
    const { sessionId } = req.body;
    const session = sessions[sessionId];
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        const timestamp = new Date().toISOString();
        session.lastSaved = timestamp;

        // Use character name and ID for filename, sanitize it
        const safeName = session.character.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeName}_${sessionId}.json`;
        const filePath = path.join(SAVES_DIR, filename);

        fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
        console.log(`Saved game to ${filePath}`);

        res.json({ message: 'Game saved successfully', filename, timestamp });
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({ error: 'Failed to save game' });
    }
});

app.get('/api/saves', (req, res) => {
    try {
        const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
        const saveList = files.map(f => {
            const content = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f)));
            return {
                filename: f,
                characterName: content.character.name,
                race: content.character.race,
                class: content.character.class,
                model: content.model,
                lastSaved: content.lastSaved,
                sessionId: content.id
            };
        });

        // Sort by newest first
        saveList.sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved));

        res.json({ saves: saveList });
    } catch (error) {
        console.error('Error listing saves:', error);
        res.status(500).json({ error: 'Failed to list saves' });
    }
});

app.post('/api/load', (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    try {
        const filePath = path.join(SAVES_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Save file not found' });
        }

        const sessionData = JSON.parse(fs.readFileSync(filePath));
        // Restore to memory
        sessions[sessionData.id] = sessionData;

        console.log(`Loaded game session ${sessionData.id}`);
        res.json({ sessionId: sessionData.id, message: 'Game loaded' });
    } catch (error) {
        console.error('Error loading game:', error);
        res.status(500).json({ error: 'Failed to load game' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
