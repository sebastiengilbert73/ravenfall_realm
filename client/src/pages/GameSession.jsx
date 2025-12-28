import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
        fetch(`http://localhost:3000/api/state/${sessionId}`)
            .then(res => {
                if (!res.ok) throw new Error("Session not found");
                return res.json();
            })
            .then(data => setGameState(data))
            .catch(err => {
                console.error(err);
                navigate('/');
            });
    }, [sessionId, navigate]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [gameState?.history]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const action = input;
        setInput('');
        setProcessing(true);
        setHasUnsavedChanges(true); // Mark as dirty

        // Optimistic update
        setGameState(prev => ({
            ...prev,
            history: [...prev.history, { role: 'user', content: action }]
        }));

        try {
            const res = await fetch('http://localhost:3000/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action })
            });
            const data = await res.json();

            // Since the backend might have added multiple messages (rolls + narrative), 
            // we should re-fetch the full state to sync perfectly, OR we trust the backend
            // return. The current backend returns just the final { message: "..." }.
            // BUT, the history on server has changed more than that.
            // To see the rolls, we MUST fetch the full updated history.

            const stateRes = await fetch(`http://localhost:3000/api/state/${sessionId}`);
            const updatedState = await stateRes.json();
            setGameState(updatedState);

        } catch (error) {
            console.error("Action failed", error);
        } finally {
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
                setHasUnsavedChanges(true); // Changing model counts as a change worth saving
            }
        } catch (err) {
            console.error("Failed to switch model", err);
        }
    };

    const renderMessage = (msg, idx) => {
        // Filter out original system prompt, but keep system messages generated during play (like rolls)
        // The original system prompt is usually the very first message.
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

        // Format assistant messages to potentially highlight the Roll Command
        let content = msg.content;

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

    return (
        <div className="game-container">
            <aside className="sidebar">
                <h3>Character Sheet</h3>
                <div className="char-info">
                    <p><strong>Name:</strong> {gameState.character.name}</p>
                    <p><strong>Race:</strong> {gameState.character.race}</p>
                    <p><strong>Class:</strong> {gameState.character.class}</p>

                    <div className="ingame-model-selector">
                        <label>Dungeon Master:</label>
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
                    <h4>Stats</h4>
                    <ul>
                        {Object.entries(gameState.character.stats).map(([key, val]) => (
                            <li key={key}><strong>{key.toUpperCase()}:</strong> {val}</li>
                        ))}
                    </ul>
                </div>
                <div className="sidebar-actions">
                    <button onClick={() => handleSave().then(success => success && alert('Game Saved!'))} disabled={saving} className="btn-secondary">
                        {saving ? 'Saving...' : 'Save Game'}
                    </button>
                    <button onClick={handleExitRequest} className="btn-secondary">
                        Exit
                    </button>
                </div>
            </aside>
            <main className="chat-interface">
                <div className="chat-log">
                    {gameState.history.map((msg, idx) => renderMessage(msg, idx))}
                    {processing && <div className="message assistant"><div className="bubble"><em>The DM is thinking...</em></div></div>}
                    <div ref={chatEndRef} />
                </div>
                <form className="action-bar" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="What do you do?"
                        disabled={processing}
                    />
                    <button type="submit" disabled={processing || !input.trim()}>Act</button>
                </form>
            </main>

            {/* Exit Confirmation Modal */}
            {showExitModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Unsaved Changes</h3>
                        <p>You have unsaved progress. Do you want to save before exiting?</p>
                        <div className="modal-actions">
                            <button
                                onClick={handleSaveAndExit}
                                className="btn-primary"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save & Exit'}
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="btn-danger"
                            >
                                Exit without Saving
                            </button>
                            <button
                                onClick={() => setShowExitModal(false)}
                                className="btn-text"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GameSession;
