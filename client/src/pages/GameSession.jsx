import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TRANSLATIONS = {
    en: {
        characterSheet: "Character Sheet",
        name: "Name",
        gender: "Gender",
        race: "Race",
        class: "Class",
        dm: "Dungeon Master",
        stats: "Stats",
        saveGame: "Save Game",
        saving: "Saving...",
        exit: "Exit",
        saveAndExit: "Save & Exit",
        exitNoSave: "Exit without Saving",
        cancel: "Cancel",
        unsavedChanges: "Unsaved Changes",
        unsavedMessage: "You have unsaved progress. Do you want to save before exiting?",
        gameSaved: "Game Saved!",
        inputPlaceholder: "What do you do?",
        act: "Act",
        thinking: "The DM is thinking...",
        statsLabels: { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" },
        genders: {
            Male: "Male",
            Female: "Female",
            NonBinary: "Non-binary",
            Other: "Other"
        }
    },
    fr: {
        characterSheet: "Fiche de Personnage",
        name: "Nom",
        gender: "Genre",
        race: "Race",
        class: "Classe",
        dm: "Maître du Donjon",
        stats: "Statistiques",
        saveGame: "Sauvegarder",
        saving: "Sauvegarde...",
        exit: "Quitter",
        saveAndExit: "Sauvegarder & Quitter",
        exitNoSave: "Quitter sans Sauvegarder",
        cancel: "Annuler",
        unsavedChanges: "Modifications non sauvegardées",
        unsavedMessage: "Vous avez des progrès non sauvegardés. Voulez-vous sauvegarder avant de quitter ?",
        gameSaved: "Partie Sauvegardée !",
        inputPlaceholder: "Que faites-vous ?",
        act: "Agir",
        thinking: "Le MD réfléchit...",
        statsLabels: { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" },
        genders: {
            Male: "Homme",
            Female: "Femme",
            NonBinary: "Non-binaire",
            Other: "Autre"
        }
    }
};

// Helper to process inline formatting (bold)
const processInline = (text) => {
    if (!text) return null;
    // Split by **...**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

// Main formatter
const formatText = (text) => {
    if (!text) return null;

    // 1. Check for the specific list pattern " * **" which indicates a list item with a bold title
    // or just " * " if it looks like a list.
    // The user screenshot showed: " : * **Projectile..."

    // We split by " * " but try to be smart about it.
    // Let's rely on the pattern space-asterisk-space or space-asterisk-bold

    if (text.includes(' * ') || text.includes('\n* ')) {
        // Normalize newlines
        let cleanText = text.replace(/\n\* /g, ' * ');

        // Split by " * "
        const rawSegments = cleanText.split(/\s\*\s/);

        // If we found multiple segments, render as list
        // Note: The first segment is the intro text
        if (rawSegments.length > 1) {
            return (
                <div>
                    {processInline(rawSegments[0])}
                    <ul>
                        {rawSegments.slice(1).map((seg, i) => (
                            <li key={i}>{processInline(seg)}</li>
                        ))}
                    </ul>
                </div>
            );
        }
    }

    // Fallback: just inline formatting
    return processInline(text);
};

function GameSession() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState(null);
    const [input, setInput] = useState('');
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);
    const chatEndRef = useRef(null);

    // Smart Exit State
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);

    // Model Switching State
    const [models, setModels] = useState([]);

    useEffect(() => {
        // Fetch models (for switcher)
        fetch('http://localhost:3000/api/models')
            .then(res => res.json())
            .then(data => setModels(data.models || []))
            .catch(err => console.error(err));

        // Fetch Game State
        fetchState();
    }, [sessionId, navigate]);

    const fetchState = () => {
        return fetch(`http://localhost:3000/api/state/${sessionId}`)
            .then(res => {
                if (!res.ok) throw new Error("Session not found");
                return res.json();
            })
            .then(data => setGameState(data))
            .catch(err => {
                console.error(err);
                navigate('/');
            });
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [gameState?.history]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const action = input;
        setInput('');
        setProcessing(true);
        setHasUnsavedChanges(true);

        // Optimistic update
        setGameState(prev => ({
            ...prev,
            history: [...prev.history, { role: 'user', content: action }]
        }));

        processAction(action);
    };

    // Recursive function to handle turn steps
    const processAction = async (action) => {
        try {
            const res = await fetch('http://localhost:3000/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action })
            });
            const data = await res.json();

            // Refresh state to show result
            await fetchState();

            if (data.status === 'continue') {
                // Determine loop delay (optional UX pause)
                setTimeout(() => processContinue(), 500);
            } else {
                setProcessing(false);
            }
        } catch (error) {
            console.error("Action failed", error);
            setProcessing(false);
        }
    };

    const processContinue = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/continue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const data = await res.json();

            // Refresh state
            await fetchState();

            if (data.status === 'continue') {
                setTimeout(() => processContinue(), 500);
            } else {
                setProcessing(false);
            }
        } catch (error) {
            console.error("Continue failed", error);
            setProcessing(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('http://localhost:3000/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const data = await res.json();
            if (res.ok) {
                setHasUnsavedChanges(false); // Clear dirty flag
                return true;
            } else {
                alert('Failed to save game.');
                return false;
            }
        } catch (err) {
            console.error("Save failed", err);
            alert('Error communicating with server.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleExitRequest = () => {
        if (hasUnsavedChanges) {
            setShowExitModal(true);
        } else {
            navigate('/');
        }
    };

    const handleSaveAndExit = async () => {
        const success = await handleSave();
        if (success) {
            navigate('/');
        }
    };

    const handleModelChange = async (newModel) => {
        try {
            const res = await fetch('http://localhost:3000/api/session/model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, model: newModel })
            });
            if (res.ok) {
                setGameState(prev => ({ ...prev, model: newModel }));
                setHasUnsavedChanges(true);
            }
        } catch (err) {
            console.error("Failed to switch model", err);
        }
    };

    const renderMessage = (msg, idx) => {
        if (idx === 0 && msg.role === 'system') return null;

        if (msg.role === 'system') {
            return (
                <div key={idx} className="message system">
                    <div className="system-bubble">
                        <span className="icon">🎲</span> {msg.content}
                    </div>
                </div>
            );
        }

        // Use the new formatter
        let content = formatText(msg.content);

        return (
            <div key={idx} className={`message ${msg.role}`}>
                <div className="bubble">
                    {msg.role === 'assistant' ? <strong>DM: </strong> : <strong>You: </strong>}
                    {content}
                </div>
            </div>
        );
    };

    if (!gameState) return <div className="loading">Summoning the world...</div>;

    const lang = gameState.language || 'en';
    const text = TRANSLATIONS[lang] || TRANSLATIONS.en;

    return (
        <div className="game-container">
            <aside className="sidebar">
                <h3>{text.characterSheet}</h3>
                <div className="char-info">
                    <p><strong>{text.name}:</strong> {gameState.character.name}</p>
                    <div className="ingame-model-selector">
                        <p><strong>{text.gender}:</strong> {
                            text.genders[gameState.character.gender] || gameState.character.gender
                        }</p>
                    </div>
                    <p><strong>{text.race}:</strong> {gameState.character.race}</p>
                    <p><strong>{text.class}:</strong> {gameState.character.class}</p>

                    <div className="ingame-model-selector">
                        <label>{text.dm}:</label>
                        {models.length > 0 ? (
                            <select
                                value={gameState.model || ''}
                                onChange={(e) => handleModelChange(e.target.value)}
                            >
                                {models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <span>{gameState.model}</span>
                        )}
                    </div>
                </div>
                <div className="stats-list">
                    <h4>{text.stats}</h4>
                    <ul>
                        {Object.entries(gameState.character.stats).map(([key, val]) => (
                            <li key={key}><strong>{text.statsLabels[key] || key.toUpperCase()}:</strong> {val}</li>
                        ))}
                    </ul>
                </div>
                <div className="sidebar-actions">
                    <button onClick={() => handleSave().then(success => success && alert(text.gameSaved))} disabled={saving} className="btn-secondary">
                        {saving ? text.saving : text.saveGame}
                    </button>
                    <button onClick={handleExitRequest} className="btn-secondary">
                        {text.exit}
                    </button>
                </div>
            </aside>
            <main className="chat-interface">
                <div className="chat-log">
                    {gameState.history.map((msg, idx) => renderMessage(msg, idx))}
                    {processing && <div className="message assistant"><div className="bubble"><em>{text.thinking}</em></div></div>}
                    <div ref={chatEndRef} />
                </div>
                <form className="action-bar" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={text.inputPlaceholder}
                        disabled={processing}
                    />
                    <button type="submit" disabled={processing || !input.trim()}>{text.act}</button>
                </form>
            </main>

            {/* Exit Confirmation Modal */}
            {showExitModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{text.unsavedChanges}</h3>
                        <p>{text.unsavedMessage}</p>
                        <div className="modal-actions">
                            <button
                                onClick={handleSaveAndExit}
                                className="btn-primary"
                                disabled={saving}
                            >
                                {saving ? text.saving : text.saveAndExit}
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="btn-danger"
                            >
                                {text.exitNoSave}
                            </button>
                            <button
                                onClick={() => setShowExitModal(false)}
                                className="btn-text"
                            >
                                {text.cancel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GameSession;
