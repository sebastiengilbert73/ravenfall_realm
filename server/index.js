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
// Key: sessionId, Value: { character: {}, history: [], model: string, language: string }
const sessions = {};

const SYSTEM_PROMPT_EN = `You are the Dungeon Master (DM) for a Dungeons and Dragons game. 
You will describe the world, non-player characters (NPCs), and events. 
The player will tell you their actions.

**IMPORTANT: DICE ROLLING**
You must NOT ask the player to roll dice. You must determine when a roll is needed (combat, ability checks, saving throws).
To perform a roll, you MUST include a special command in your response: \`[[ROLL: XdY+Z]]\`
- Example: \`[[ROLL: 1d20+3]]\` or \`[[ROLL: 2d6]]\`
- **CRITICAL**: Output ONLY ONE [[ROLL]] command per response. STOP immediately after the command.
- The system will roll the dice and provide the result on the next instruction.
- Use the provided result to narrate the outcome.

**General Rules:**
1. Describe the outcomes of the player's actions based on 5th Edition rules.
2. Keep descriptions vivid but concise.
3. Do not act for the player.
4. **TECHNICAL JARGON BANNED**: NEVER use technical labels like "UPDATE_MAP", "ROLL", "DEX_MOD", "JET D'ATTAQUE", etc., in your narrative. Use only descriptive, story-driven language.
5. If a combat occurs, manage the initiative and turns using the ROLL commands.
6. **PLAYER ROLLS**:
   - If the player needs to make a check or save (e.g., DEX Save), YOU must generate the roll for them using \`[[ROLL: ...]]\`.
   - Use the player's stats provided below to calculate the modifier.
   - **INITIATIVE**: After resolving the player's action (and any resulting rolls), YOU must immediately play out the turns of any hostile NPCs or companions present.
   - **COMPANION & NPC TURNS**: All allies (companions) and enemies are controlled by YOU. When it is their turn, YOU MUST decide their action, narrate it, and output a \`[[ROLL: ...]]\` for their attack or check. **NEVER** ask the player "What do they do?" or wait for their input.
   - **INITIATIVE ORDER**: You MUST follow initiative order strictly. Play out ALL turns in descending order before giving control back to the player.
   - **COMBAT START**: When combat begins, you MUST output \`[[ROLL_GROUP: Player=1d20+DEX_MOD, Enemy1=1d20+Mod, ...]]\` for initiative of ALL participants. DO NOT narrate attack rolls in text; use the system command. STOP immediately after the command.
   - **COMBAT TRANSITION**: If your narration leads to an encounter, you MUST end the message with the initiative [[ROLL_GROUP]] command. Do NOT ask the player "What do you do?" if it's time for initiative.
6. **HP/MP UPDATES**:
   - If player takes damage or uses mana, output: \`[[UPDATE_STATS: { "hp": -damage, "mp": -cost }]]\`
   - Use negative numbers for loss, positive for healing.

7. **POSITION TRACKING - CRITICAL - NEVER FORGET THIS**:
   - EVERY SINGLE RESPONSE MUST END WITH: \`[[coordinates[x: X, y: Y]]]\`
   - Starting village = (0, 0). North = +Y, South = -Y, East = +X, West = -X.
   - Example: \`[[coordinates[x: 5, y: -3]]]\` (5 units East, 3 units South of village)
   - THIS IS MANDATORY. NO EXCEPTIONS.

Current Player Character:
`;

const SYSTEM_PROMPT_FR = `Vous êtes le Maître du Donjon (MD) pour une partie de Donjons et Dragons.
Vous décrirez le monde, les personnages non-joueurs (PNJ) et les événements en FRANÇAIS.
Le joueur vous dira ses actions.

**IMPORTANT : LANCER DE DÉS**
Vous NE devez PAS demander au joueur de lancer les dés. Vous devez déterminer quand un jet est nécessaire (combat, tests de compétence, jets de sauvegarde).
Pour effectuer un jet, vous DEVEZ inclure une commande spéciale dans votre réponse : \`[[ROLL: XdY+Z]]\`
- Exemple : \`[[ROLL: 1d20+3]]\` ou \`[[ROLL: 2d6]]\`
- **CRITIQUE**: Sortez UN SEUL [[ROLL]] par réponse. ARRÊTEZ-VOUS immédiatement après la commande.
- Le système lancera les dés et vous fournira le résultat lors de la prochaine instruction.
- Utilisez le résultat fourni pour narrer la suite.

**Règles Générales :**
1. Décrivez les conséquences des actions du joueur selon les règles de la 5e édition.
2. Gardez les descriptions vivantes mais concises.
3. Ne jouez pas à la place du joueur.
4. **JARGON TECHNIQUE INTERDIT**: N'utilisez JAMAIS de labels techniques comme "UPDATE_MAP", "ROLL", "DEX_MOD", "JET D'ATTAQUE", etc., dans votre narration. Utilisez un langage purement narratif.
5. If a combat occurs, manage the initiative and turns using the ROLL commands.
6. RÉPONDEZ TOUJOURS EN FRANÇAIS.
7. **JETS DU JOUEUR**:
   - Si le joueur doit faire un test ou une sauvegarde (ex: Sauvegarde de DEX), VOUS devez générer le lancer pour lui avec \`[[ROLL: ...]]\`.
   - Utilisez les stats du joueur fournies ci-dessous pour calculer le modificateur.
   - **INITIATIVE**: Après avoir résolu l'action du joueur (et les jets associés), VOUS devez immédiatement jouer le tour des PNJ hostiles ou des compagnons présents.
   - **TOURS DES COMPAGNONS & PNJS**: Tous les alliés (compagnons) et ennemis sont contrôlés par VOUS. Quand c'est leur tour, VOUS DEVEZ décider de leur action, la narrer, et sortir un \`[[ROLL: ...]]\` pour leur attaque ou test. **NE JAMAIS** demander au joueur "Que font-ils ?" ou attendre son instruction.
   - **ORDRE D'INITIATIVE**: Vous DEVEZ suivre l'ordre d'initiative strictement. Jouez TOUS les tours dans l'ordre décroissant avant de redonner la main au joueur.
   - **DÉBUT DE COMBAT**: Quand un combat commence, vous DEVEZ sortir \`[[ROLL_GROUP: Joueur=1d20+DEX_MOD, Ennemi1=1d20+Mod, ...]]\` pour l'initiative de TOUS les participants. NE décrivez PAS les jets d'initiative dans le texte ; utilisez la commande système. ARRÊTEZ-VOUS immédiatement après la commande.
   - **TRANSITION DE COMBAT**: Si votre narration mène à une rencontre, vous DEVEZ terminer le message par la commande d'initiative [[ROLL_GROUP]]. Ne demandez PAS au joueur "Que faites-vous ?" s'il est temps de lancer l'initiative.
7. **CHANGEMENTS D'ÉTAT (PV/PM)**:
   - Si le joueur perd des PV (dégâts) ou des PM (sorts), utilisez: \`[[UPDATE_STATS: { "hp": -5, "mp": -1 }]]\`
   - Utilisez des valeurs négatives pour les dégâts/coûts, positives pour soins/récupération.

8. **SUIVI DE POSITION - CRITIQUE - N'OUBLIEZ JAMAIS CECI**:
   - CHAQUE RÉPONSE DOIT SE TERMINER PAR: \`[[coordinates[x: X, y: Y]]]\`
   - Village de départ = (0, 0). Nord = +Y, Sud = -Y, Est = +X, Ouest = -X.
   - Exemple: \`[[coordinates[x: 5, y: -3]]]\` (5 unités à l'Est, 3 unités au Sud du village)
   - CECI EST OBLIGATOIRE. AUCUNE EXCEPTION.

Personnage du Joueur Actuel :
`;

// Helper: Parse dice string (e.g. "1d20+5")
function parseDice(expression) {
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

// Helper: Update map data
function updateMapData(session, mapUpdate) {
    if (!session.mapData) session.mapData = [];

    const existingIndex = session.mapData.findIndex(p => p.name === mapUpdate.name);
    if (existingIndex >= 0) {
        // Update existing node (e.g. rumored -> visited)
        session.mapData[existingIndex] = { ...session.mapData[existingIndex], ...mapUpdate };
    } else {
        // Add new node
        session.mapData.push(mapUpdate);
    }
}

// Logic to process one turn of generation
async function processTurn(session) {
    console.log(`Generating response for session ${session.id}...`);

    let context = [...session.history];
    const lastMsg = context[context.length - 1];

    // If we are continuing from a System Roll message, strictly forbid playing the user's turn
    if (lastMsg.role === 'system' && (lastMsg.content.includes('Result:') || lastMsg.content.includes('Résultat :'))) {
        const warning = session.language === 'fr'
            ? "Système : Décrivez le résultat du dé. Si c'est au tour de l'ennemi OU d'un compagnon (allié), continuez. Si c'est au tour du JOUEUR, ARRÊTEZ-VOUS. Ne décrivez PAS l'action du joueur."
            : "System: Describe the result of the roll. If it is the enemy's or a companion's (ally) turn, continue. If it is the PLAYER'S turn, STOP. Do NOT describe the player's action.";

        context.push({ role: 'system', content: warning });
    }

    // Detection for combat start / initiative request without proper command
    const combatKeywords = session.language === 'fr' ? ['combat', 'initiative', 'tour suivante', 'ordre de tour'] : ['combat', 'initiative', 'next turn', 'turn order', 'round'];
    const lastMsgContent = (lastMsg.content || "").toLowerCase();
    const needsCombatReminder = combatKeywords.some(kw => lastMsgContent.includes(kw));

    // Persistent Combat Detection (checking last 5 messages for combat context)
    const recentHistory = (session.history || []).slice(-5).map(h => h.content.toLowerCase()).join(' ');
    const isOngoingCombat = combatKeywords.some(kw => recentHistory.includes(kw)) || recentHistory.includes('roll_group');

    if (needsCombatReminder) {
        const combatStartReminder = session.language === 'fr'
            ? "[RAPPEL CRITIQUE: Si un combat commence, vous DEVEZ utiliser [[ROLL_GROUP: Joueur=1d20+DEX_MOD, Ennemi1=1d20+Mod, ...]] pour l'initiative de TOUS les participants (Joueurs, Alliés et Ennemis). Ne demandez PAS au joueur de lancer.]"
            : "[CRITICAL REMINDER: If combat begins, you MUST use [[ROLL_GROUP: Player=1d20+DEX_MOD, Enemy1=1d20+Mod, ...]] for initiative of ALL participants (Players, Allies, and Enemies). Do NOT ask the player to roll.]";
        context.push({ role: 'system', content: combatStartReminder });
    } else if (isOngoingCombat) {
        const ongoingCombatReminder = session.language === 'fr'
            ? "[RAPPEL DE COMBAT: Le combat est en cours. Vous DEVEZ jouer les tours de TOUS les PNJs, alliés (compagnons) et ennemis dans l'ordre d'initiative. Décrivez leur action et sortez un [[ROLL]] maintenant. NE DEMANDEZ PAS au joueur ce qu'ils font (Ex: Ne dites PAS 'Que fait Kaelen ?'). DECIDEZ POUR EUX.]"
            : "[COMBAT REMINDER: Combat is ongoing. You MUST play the turns of ALL NPCs, allies (companions), and enemies in initiative order. Describe their action and output a [[ROLL]] command NOW. DO NOT ask the player what they do (Ex: Do NOT say 'What does Kaelen do?'). DECIDE FOR THEM.]";
        context.push({ role: 'system', content: ongoingCombatReminder });
    }

    // Inject Companion List into Context
    if (session.companions && session.companions.length > 0) {
        const names = session.companions.map(c => `${c.name} (${c.class})`).join(', ');
        const companionNote = session.language === 'fr'
            ? `[RAPPEL SYSTEME: Compagnons actifs présents : ${names}. VOUS contrôlez leurs actions en combat. Ne demandez PAS au joueur ce qu'ils font.]`
            : `[SYSTEM NOTE: Active Companions present: ${names}. YOU control their actions in combat. Do NOT ask the player what they do.]`;

        // Push to context (temporary for this turn)
        context.push({ role: 'system', content: companionNote });
    }

    // CRITICAL: Inject coordinate reminder EVERY turn
    const coordinateReminder = session.language === 'fr'
        ? `[RAPPEL CRITIQUE: Vous DEVEZ terminer votre réponse avec [[coordinates[x: X, y: Y]]]. C'est OBLIGATOIRE.]`
        : `[CRITICAL REMINDER: You MUST end your response with [[coordinates[x: X, y: Y]]]. This is MANDATORY.]`;
    context.push({ role: 'system', content: coordinateReminder });

    // Generate response
    const responseText = await generateResponse(context, session.model);
    console.log("LLM Response Raw:", responseText);

    let cleanText = cleanLLMResponse(responseText);
    const fullTextForParsing = cleanText; // Keep a copy for parsing coordinates/stats before roll truncation
    console.log("LLM Response Cleaned:", cleanText);

    // CRITICAL: Check for ROLL commands FIRST and truncate immediately
    // This prevents the LLM from hallucinating the dice result
    const groupRollMatch = cleanText.match(/\[\[ROLL_GROUP:\s*(.*?)\]\]/i);
    const rollMatch = cleanText.match(/\[\[ROLL:\s*(.*?)\]\]/i);

    if (groupRollMatch) {
        const commandEndIndex = groupRollMatch.index + groupRollMatch[0].length;
        cleanText = cleanText.substring(0, commandEndIndex);
        console.log("Truncated response at ROLL_GROUP command.");
    } else if (rollMatch) {
        const commandEndIndex = rollMatch.index + rollMatch[0].length;
        cleanText = cleanText.substring(0, commandEndIndex);
        console.log("Truncated response at ROLL command to enforce stop.");
    }

    // Secondary fallback: Truncate if LLM hallucinated the System labels
    const systemStopMatch = cleanText.match(/(?:Système\s*:|System\s*:)/i);
    if (systemStopMatch) {
        // Roll command usually precedes this, but if not, we still want to truncate before the hallucinated result
        cleanText = cleanText.substring(0, systemStopMatch.index).trim();
        console.log("Truncated response at hallucinated System label.");
    }

    // --- SELF-CORRECTION: Forbid asking for player input during NPC/Companion turns ---
    const questionKeywords = session.language === 'fr'
        ? ['que fait', 'quelle est son action', 'que décide', 'qu\'est-ce qu\'il fait']
        : ['what does', 'what is their action', 'what will they do', 'what do they do'];

    // If we're in combat, no roll was generated, and the DM is asking a question...
    if (isOngoingCombat && !cleanText.includes('[[ROLL') && questionKeywords.some(kw => cleanText.toLowerCase().includes(kw))) {
        console.log("DM is asking for input instead of taking NPC action. Triggering self-correction pass...");
        const correctionReminder = session.language === 'fr'
            ? "[SYSTEME: RAPPEL: Vous NE DEVEZ PAS demander au joueur ce que font les compagnons ou ennemis. Vous DEVEZ décider pour eux, narrer l'action et sortir un [[ROLL]] maintenant. RE-GENEREZ votre réponse.]"
            : "[SYSTEM: REMINDER: You MUST NOT ask the player what companions or enemies do. You MUST decide for them, narrate the action, and output a [[ROLL]] command now. RE-GENERATE your response.]";

        const correctionContext = [...context, { role: 'assistant', content: responseText }, { role: 'system', content: correctionReminder }];
        const correctedResponse = await generateResponse(correctionContext, session.model);

        // Use the corrected response instead
        const freshCleaned = cleanLLMResponse(correctedResponse);
        cleanText = freshCleaned;

        // Re-check for roll in the corrected text
        const freshRoll = cleanText.match(/\[\[ROLL:\s*(.*?)\]\]/i);
        if (freshRoll) {
            cleanText = cleanText.substring(0, freshRoll.index + freshRoll[0].length);
        }
    }

    // 1. Check for COORDINATES command (simpler format)
    // We use fullTextForParsing in case coordinates were after the ROLL command
    const coordRegex = /\[\[coordinates\[x:\s*(-?\d+),\s*y:\s*(-?\d+)\]\]\]/i;
    let coordMatch = fullTextForParsing.match(coordRegex);

    if (!coordMatch) {
        console.log("Coordinates missing! Triggering self-correction pass...");
        const correctionPrompt = session.language === 'fr'
            ? `[SYSTEME: Les coordonnées [[coordinates[x: X, y: Y]]] manquent. Basé sur votre dernière narration, quelles sont les coordonnées actuelles ? Répondez UNIQUEMENT avec la commande.]`
            : `[SYSTEM: The [[coordinates[x: X, y: Y]]] command is missing. Based on your last narration, what are the current coordinates? Respond ONLY with the command.]`;

        const tempContext = [...context, { role: 'assistant', content: responseText }, { role: 'system', content: correctionPrompt }];
        const correctionText = await generateResponse(tempContext, session.model);
        console.log("Self-correction response:", correctionText);
        coordMatch = correctionText.match(coordRegex);
    }

    if (coordMatch) {
        const x = parseInt(coordMatch[1]);
        const y = parseInt(coordMatch[2]);
        console.log(`Coordinates found: (${x}, ${y})`);

        // Check if this location already exists in mapData
        if (!session.mapData) session.mapData = [];
        const existing = session.mapData.find(node => node.x === x && node.y === y);

        if (!existing) {
            // New location - add green dot
            const locationName = session.language === 'fr' ? `Position (${x}, ${y})` : `Location (${x}, ${y})`;
            session.mapData.push({
                name: locationName,
                type: 'visited',
                x: x,
                y: y,
                status: 'visited',
                description: ''
            });
            console.log(`New location added: (${x}, ${y})`);
        }

        // Store current position
        session.currentPosition = { x, y };
    }

    // 2. Check for STATS updates (HP/MP)
    // Format: [[UPDATE_STATS: {"hp": -5, "mp": -1}]] (Deltas)
    // Use fullTextForParsing in case stats were after ROLL command
    const statsRegex = /\[\[UPDATE_STATS:\s*({.*?})\]\]/g;
    let match;
    while ((match = statsRegex.exec(fullTextForParsing)) !== null) {
        try {
            const updates = JSON.parse(match[1]);
            console.log("Stats Update:", updates);
            if (session.character) {
                if (updates.hp !== undefined) session.character.hp = Math.max(0, Math.min(session.character.maxHp, session.character.hp + updates.hp));
                if (updates.mp !== undefined) session.character.mp = Math.max(0, Math.min(session.character.maxMp, session.character.mp + updates.mp));
            }
        } catch (e) {
            console.error("Failed to parse Stats Update:", e);
        }
    }

    // 2.2 Backup Stat Extraction (Regex for "HP: 10/20" or "PV : 10/20")
    // Helpful if the LLM forgets the explicit command but writes it in the text.
    // Matches: "PV : 10/20" or "HP: 10/30" or "Points de vie : 15 / 30"
    if (session.character) {
        // Try X/Y format first (e.g., "PV 7/10")
        const hpRegexFull = /(?:HP|PV|Points de vie|Health)\s*[:\-]?\s*(\d+)\s*\/\s*(\d+)/i;
        const hpMatchFull = fullTextForParsing.match(hpRegexFull);
        if (hpMatchFull) {
            const current = parseInt(hpMatchFull[1]);
            const max = parseInt(hpMatchFull[2]);
            // Only update if it looks reasonable (e.g. max matches our max, or is close)
            if (max === session.character.maxHp) {
                console.log(`Fallback HP Update (X/Y): ${current}/${max}`);
                session.character.hp = Math.max(0, Math.min(max, current));
            }
        } else {
            // Try single value format (e.g., "PV 7" or "PV: 7")
            // Pattern: Look for player name followed by PV X
            const hpRegexSingle = /(?:PV|HP)\s*[:\-]?\s*(\d+)(?:\s*,|\s*$|\s+CA)/i;
            const hpMatchSingle = fullTextForParsing.match(hpRegexSingle);
            if (hpMatchSingle) {
                const current = parseInt(hpMatchSingle[1]);
                // Only update if value is reasonable (0 to maxHp)
                if (current >= 0 && current <= session.character.maxHp) {
                    console.log(`Fallback HP Update (single): ${current}`);
                    session.character.hp = current;
                } else if (current > session.character.maxHp) {
                    // The LLM might have the wrong max, trust it but clamp to maxHp
                    console.log(`Fallback HP Update (single, clamped): ${current} -> ${session.character.maxHp}`);
                    session.character.hp = session.character.maxHp;
                }
            }
        }
    }

    // 2.5 Check for COMPANION updates
    const addCompRegex = /\[\[ADD_COMPANION:\s*({.*?})\]\]/g;
    while ((match = addCompRegex.exec(cleanText)) !== null) {
        try {
            const comp = JSON.parse(match[1]);
            if (!session.companions) session.companions = [];
            // Avoid duplicates
            if (!session.companions.find(c => c.name === comp.name)) {
                session.companions.push(comp);
                console.log("Companion Added:", comp);
            }
        } catch (e) {
            console.error("Failed to parse ADD_COMPANION:", e);
        }
    }

    const removeCompRegex = /\[\[REMOVE_COMPANION:\s*"(.*?)"\]\]/g;
    while ((match = removeCompRegex.exec(cleanText)) !== null) {
        const nameToRemove = match[1];
        if (session.companions) {
            session.companions = session.companions.filter(c => c.name !== nameToRemove);
            console.log("Companion Removed:", nameToRemove);
        }
    }

    // Final narrative cleanup for history: strip ALL technical commands [[...]]
    // This prevents the LLM from seeing them in context and hallucinating/translating them
    const narrativeForHistory = cleanText.replace(/\[\[[\s\S]*?\]\]/g, '').trim();

    // 3. Check for ROLL commands
    if (groupRollMatch) {
        const groupStr = groupRollMatch[1];
        const entries = groupStr.split(',').map(e => e.trim());
        const results = [];

        for (const entry of entries) {
            const parts = entry.split('=');
            if (parts.length < 2) continue;
            const name = parts[0].trim();
            const expr = parts[1].trim();

            const diceData = parseDice(expr);
            if (diceData) {
                const roll = rollDice(diceData);
                results.push({ name, ...roll });
            }
        }

        // Sort results by total (descending) for initiative clarity
        results.sort((a, b) => b.total - a.total);

        let groupMsg;
        if (session.language === 'fr') {
            groupMsg = "Système : Résultats de Groupe\n" + results.map(r => `- ${r.name} : ${r.total} (Jet: ${r.expression})`).join('\n');
        } else {
            groupMsg = "System: Group Results\n" + results.map(r => `- ${r.name}: ${r.total} (Rolled: ${r.expression})`).join('\n');
        }

        console.log(groupMsg);

        session.history.push({ role: 'assistant', content: narrativeForHistory });
        session.history.push({ role: 'system', content: groupMsg });

        return { status: 'continue', message: cleanText, mapData: session.mapData };
    } else if (rollMatch) {
        const expression = rollMatch[1];
        console.log(`DM requested roll: ${expression}`);

        const diceData = parseDice(expression);
        if (diceData) {
            const result = rollDice(diceData);

            // Localize System Message
            let systemMsg;
            if (session.language === 'fr') {
                systemMsg = `Système : Jet de ${result.expression}. Résultat : ${result.total} (Dés : ${result.rolls.join(', ')})`;
            } else {
                systemMsg = `System: Rolled ${result.expression}. Result: ${result.total} (Dice: ${result.rolls.join(', ')})`;
            }

            console.log(systemMsg);

            session.history.push({ role: 'assistant', content: narrativeForHistory });
            session.history.push({ role: 'system', content: systemMsg });

            // Return status continue, meaning client should call again
            return { status: 'continue', message: cleanText, mapData: session.mapData };
        } else {
            console.error("Failed to parse dice expression");
            session.history.push({ role: 'assistant', content: narrativeForHistory });
            return { status: 'complete', message: cleanText, mapData: session.mapData };
        }
    } else {
        // No roll, this is the final narrative
        session.history.push({ role: 'assistant', content: narrativeForHistory });
        return { status: 'complete', message: cleanText, mapData: session.mapData };
    }
}


app.get('/api/models', async (req, res) => {
    const models = await listModels();
    res.json({ models });
});

app.post('/api/start', async (req, res) => {
    try {
        const { character, model, language } = req.body;
        const sessionId = Date.now().toString();
        const lang = language || 'en';

        const basePrompt = lang === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;

        const spellsList = (character.spells || []).map(s => `${s.name} (${s.cost})`).join(', ');

        const initialPrompt = `${basePrompt} Name: ${character.name}, Gender: ${character.gender || 'Unknown'}, Race: ${character.race}, Class: ${character.class}. 
Stats: STR: ${character.stats.str}, DEX: ${character.stats.dex}, CON: ${character.stats.con}, INT: ${character.stats.int}, WIS: ${character.stats.wis}, CHA: ${character.stats.cha}.
${spellsList ? `Spells/Abilities: ${spellsList}.` : ''}

${lang === 'fr' ? "L'aventure commence. Décrivez la scène de départ. IMPORTANT : N'oubliez pas d'utiliser la commande [[UPDATE_MAP]] pour enregistrer l'endroit où se trouve le joueur (50, 50) comme 'visited'." : "The adventure begins. Describe the starting scene. IMPORTANT: Do not forget to use the [[UPDATE_MAP]] command to register the player's starting location (50, 50) as 'visited'."}`;

        const response = await generateResponse([{ role: 'system', content: initialPrompt }], model);
        // Clean response
        const cleanText = cleanLLMResponse(response);

        sessions[sessionId] = {
            id: sessionId,
            character,
            model,
            language: lang,
            history: [
                { role: 'system', content: initialPrompt },
                { role: 'assistant', content: cleanText }
            ],
            mapData: [],
            currentPosition: { x: 50, y: 50 },
            companions: [],
            lastSaved: null
        };

        // Initial parse of the welcome message for map updates
        const mapRegex = /\[\[UPDATE_MAP:\s*({[\s\S]*?})\]\]/g;
        let match;
        while ((match = mapRegex.exec(cleanText)) !== null) {
            try {
                const mapData = JSON.parse(match[1]);
                if (sessions[sessionId].mapData) {
                    sessions[sessionId].mapData.push(mapData);
                }
            } catch (e) {
                console.error("Failed to parse initial Map Update:", e);
            }
        }

        // Fallback: If no map data was generated, force start location
        if (sessions[sessionId].mapData.length === 0) {
            console.log("No initial map update found. Injecting fallback start location.");
            sessions[sessionId].mapData.push({
                x: 50, y: 50,
                name: lang === 'fr' ? "Départ" : "Start",
                type: "poi",
                status: "visited",
                description: lang === 'fr' ? "Votre aventure commence ici." : "Your adventure begins here."
            });
        }
        res.json({ sessionId, message: cleanText });
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

        // Process single turn
        const result = await processTurn(session);
        res.json(result);

    } catch (error) {
        console.error('Error processing action:', error);
        res.status(500).json({ error: 'Failed to process action' });
    }
});

app.post('/api/continue', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = sessions[sessionId];

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Just continue processing based on current history (which should have a system message at end)
        const result = await processTurn(session);
        res.json(result);

    } catch (error) {
        console.error('Error continuing action:', error);
        res.status(500).json({ error: 'Failed to continue action' });
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

// Helper to clean LLM response
function cleanLLMResponse(text) {
    if (!text) return "";

    // Define patterns that should indicate the end of the narrative
    const terminalTokens = [
        /<start_of_turn>/i,
        /<end_of_turn>/i,
        /<end_of_start_of_turn>/i,
        /<end_of_start\s*>/i,
        /<\|end_of_text\|>/i,
        /<\|eot_id\|>/i,
        /User:/i,
        /Player:/i,
        /Human:/i,
        /\nSystem\s*:/i,
        /\nSystème\s*:/i
    ];

    let cleaned = text;

    // 1. Find the earliest occurrence of any terminal token
    let earliestIndex = cleaned.length;
    for (const token of terminalTokens) {
        const match = cleaned.match(token);
        if (match && match.index < earliestIndex) {
            earliestIndex = match.index;
        }
    }

    // Truncate at the earliest token found
    cleaned = cleaned.substring(0, earliestIndex).trim();

    // 2. Comprehensive scrubbing pass for any fragments left behind
    const scrubPatterns = [
        /<\|start_header_id\|>assistant<\|end_header_id\|>/gi,
        /<\|start_header_id\|>|<\|end_header_id\|>|<\|reserved_special_token_\d+\|>/gi,
        /<end_of_start\s*>/gi,
        /<end_of_turn\s*>/gi,
        /<start_of_turn\s*>/gi,
        /<\|eot_id\|>/gi,
        /<\|eeo_id\|>/gi,
        /User:/gi,
        /Player:/gi,
        /Human:/gi
    ];

    scrubPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
}
