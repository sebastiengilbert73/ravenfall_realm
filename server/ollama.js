const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

// Default if nothing else is found/specified
const DEFAULT_MODEL = 'llama3';

async function listModels() {
    try {
        const list = await ollama.list();
        // Return simple list of names for frontend
        return list.models.map(m => m.name);
    } catch (error) {
        console.error("Failed to list Ollama models:", error.message);
        return [];
    }
}

async function generateResponse(messages, modelName = null) {
    try {
        // If no model specified or found, we might fallback, but ideally caller passes valid model.
        // We'll let the listing happen in the endpoint.
        let model = modelName;

        if (!model) {
            // Fallback logic if needed, but we prefer explicit selection now
            const models = await listModels();
            model = models.length > 0 ? models[0] : DEFAULT_MODEL;
        }

        console.log(`Generating with model: ${model}`);

        const response = await ollama.chat({
            model: model,
            messages: messages,
            options: {
                stop: [
                    "<start_of_turn>",
                    "<end_of_turn>",
                    "<end_of_start>",
                    "<|end_of_text|>",
                    "<|eot_id|>",
                    "User:",
                    "Player:",
                    "Human:",
                    "Système :",
                    "System:",
                    "Système:",
                    "System:",
                    "Système:",
                    "System:",
                    "<|start_header_id|>",
                    "<|end_header_id|>",
                    "<|reserved_special_token_",
                    "<|begin_of_text|>",
                    "Assistant:",
                    "Assistant :",
                    "Dungeon Master:",
                    "Maître du Donjon:"
                ]
            }
        });
        return response.message.content;
    } catch (error) {
        console.error("Ollama Error:", error);
        return `The spirits are silent. (Error: ${error.message})`;
    }
}

module.exports = { generateResponse, listModels };
