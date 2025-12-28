import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Landing() {
    const navigate = useNavigate();
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [loading, setLoading] = useState(true);

    // Save/Load state
    const [saves, setSaves] = useState([]);
    const [showLoad, setShowLoad] = useState(false);

    useEffect(() => {
        // Fetch models
        fetch('http://localhost:3000/api/models')
            .then(res => res.json())
            .then(data => {
                setModels(data.models || []);
                if (data.models && data.models.length > 0) {
                    const defaultModel = data.models.find(m => m.includes('gemma3')) || data.models.find(m => m.includes('llama3')) || data.models[0];
                    setSelectedModel(defaultModel);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch models", err);
                setLoading(false);
            });

        // Fetch saves
        fetchSaves();
    }, []);

    const fetchSaves = () => {
        fetch('http://localhost:3000/api/saves')
            .then(res => res.json())
            .then(data => setSaves(data.saves || []))
            .catch(err => console.error("Failed to fetch saves", err));
    };

    const handleStart = () => {
        navigate('/create', { state: { model: selectedModel } });
    };

    const handleLoad = async (filename) => {
        try {
            const res = await fetch('http://localhost:3000/api/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            const data = await res.json();
            if (data.sessionId) {
                navigate(`/play/${data.sessionId}`);
            }
        } catch (err) {
            console.error("Failed to load", err);
            alert("Failed to load game file.");
        }
    };

    return (
        <div className="landing-container">
            <h1>Ravenfall Realm</h1>
            <p>Enter the world of adventure.</p>

            {loading ? (
                <p>Loading arcane knowledge (models)...</p>
            ) : models.length > 0 ? (
                <div className="model-selector">
                    <label htmlFor="model-select">Select Dungeon Master:</label>
                    <select
                        id="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            ) : (
                <p className="error">No LLM models found. Please check Ollama.</p>
            )}

            <div className="landing-actions">
                <button onClick={handleStart} className="btn-primary" disabled={loading || models.length === 0}>
                    Start New Game
                </button>
                {saves.length > 0 && (
                    <button onClick={() => setShowLoad(!showLoad)} className="btn-secondary">
                        {showLoad ? 'Hide Saves' : 'Load Game'}
                    </button>
                )}
            </div>

            {showLoad && (
                <div className="saves-list">
                    <h3>Saved Games</h3>
                    {saves.map(save => (
                        <div key={save.filename} className="save-item" onClick={() => handleLoad(save.filename)}>
                            <div className="save-name">{save.characterName} - {save.race} {save.class}</div>
                            <div className="save-meta">
                                <span>{new Date(save.lastSaved).toLocaleString()}</span>
                                <span className="save-model">{save.model}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Landing;
