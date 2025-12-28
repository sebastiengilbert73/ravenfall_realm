const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

async function debug() {
    try {
        console.log("Attempting to list models...");
        const list = await ollama.list();
        console.log("Raw list response:", JSON.stringify(list, null, 2));

        if (list.models) {
            console.log("Models found:", list.models.map(m => m.name));
        } else {
            console.log("No models property in response.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

debug();
