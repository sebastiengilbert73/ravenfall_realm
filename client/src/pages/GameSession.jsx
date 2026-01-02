import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TRANSLATIONS = {
    en: {
        characterSheet: "Character Sheet",
        worldMap: "World Map",
        name: "Name",
        gender: "Gender",
        race: "Race",
        class: "Class",
        dm: "Dungeon Master",
        stats: "Stats",
        hp: "HP",
        mp: "MP",
        spells: "Spells & Abilities",
        spellName: "Spell",
        cost: "Cost",
        effect: "Effect",
        prob: "Hit/DC",
        companions: "Companions",
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
        },
        viewMap: "View Map",
        viewChar: "View Character",
        races: {
            Human: "Human",
            Elf: "Elf",
            Dwarf: "Dwarf",
            Halfling: "Halfling",
            Orc: "Orc"
        },
        classes: {
            Fighter: "Fighter",
            Wizard: "Wizard",
            Rogue: "Rogue",
            Cleric: "Cleric",
            Paladin: "Paladin"
        }
    },
    fr: {
        characterSheet: "Fiche de Personnage",
        worldMap: "Carte du Monde",
        name: "Nom",
        gender: "Genre",
        race: "Race",
        class: "Classe",
        dm: "Maître du Donjon",
        stats: "Statistiques",
        hp: "PV",
        mp: "PM",
        spells: "Sorts et Aptitudes",
        spellName: "Sort",
        cost: "Coût",
        effect: "Effet",
        prob: "Touché/DD",
        companions: "Compagnons",
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
        },
        viewMap: "Voir Carte",
        viewChar: "Voir Perso",
        races: {
            Human: "Humain",
            Elf: "Elfe",
            Dwarf: "Nain",
            Halfling: "Halfelin",
            Orc: "Orque"
        },
        classes: {
            Fighter: "Guerrier",
            Wizard: "Magicien",
            Rogue: "Voleur",
            Cleric: "Clerc",
            Paladin: "Paladin"
        }
    }
};

// Helper to process inline formatting (bold)
const processInline = (text) => {
    if (!text) return null;
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

    // Remove all technical commands [[...]] from display
    text = text.replace(/\[\[[\s\S]*?\]\]/g, '');

    if (text.includes(' * ') || text.includes('\n* ')) {
        let cleanText = text.replace('\n* ', ' * ');
        const rawSegments = cleanText.split(/\s\*\s/);
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
    const [viewMode, setViewMode] = useState('char');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [models, setModels] = useState([]);

    useEffect(() => {
        fetch('http://localhost:3000/api/models')
            .then(res => res.json())
            .then(data => setModels(data.models || []))
            .catch(err => console.error(err));

        fetchState();
    }, [sessionId, navigate]);

    const fetchState = () => {
        return fetch(`http://localhost:3000/api/state/${sessionId}`)
            .then(res => {
                if (!res.ok) throw new Error("Session not found");
                return res.json();
            })
            .then(data => {
                console.log("Initial GameState Loaded:", data);
                console.log("Initial MapData:", data.mapData);
                setGameState(data);
            })
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

        setGameState(prev => ({
            ...prev,
            history: [...prev.history, { role: 'user', content: action }]
        }));

        processAction(action);
    };

    const processAction = async (action) => {
        try {
            const res = await fetch('http://localhost:3000/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action })
            });
            const data = await res.json();
            await fetchState();

            if (data.status === 'continue') {
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
            if (res.ok) {
                setHasUnsavedChanges(false);
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

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleWheel = (e) => {
        if (viewMode !== 'map') return;
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        setZoom(z => Math.max(0.5, Math.min(3, z + scaleAmount)));
    };

    const handleMouseDown = (e) => {
        if (viewMode !== 'map') return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging || viewMode !== 'map') return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Add listener for mouseup outside the element to clean up drag
    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const renderMap = () => {
        const rawNodes = gameState?.mapData || [];

        // --- Node Spreading: Push apart overlapping nodes ---
        const minDistance = 8; // Minimum % distance between nodes for readability
        const spreadNodes = rawNodes.map(n => ({ ...n })); // Clone to avoid mutating state

        // Simple pairwise repulsion pass
        for (let i = 0; i < spreadNodes.length; i++) {
            for (let j = i + 1; j < spreadNodes.length; j++) {
                const dx = spreadNodes[j].x - spreadNodes[i].x;
                const dy = spreadNodes[j].y - spreadNodes[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDistance && dist > 0) {
                    // Push nodes apart
                    const overlap = minDistance - dist;
                    const pushX = (dx / dist) * overlap / 2;
                    const pushY = (dy / dist) * overlap / 2;

                    spreadNodes[i].x -= pushX;
                    spreadNodes[i].y -= pushY;
                    spreadNodes[j].x += pushX;
                    spreadNodes[j].y += pushY;
                } else if (dist === 0) {
                    // Exactly overlapping - offset one randomly
                    spreadNodes[j].x += minDistance / 2;
                    spreadNodes[j].y -= minDistance / 2;
                }
            }
        }

        const nodes = spreadNodes;

        // Calculate bounding box for auto-fit
        let minX = 100, maxX = 0, minY = 100, maxY = 0;
        for (const node of nodes) {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        }

        // Calculate required zoom to fit all nodes with padding
        const rangeX = maxX - minX || 10; // Prevent division by zero
        const rangeY = maxY - minY || 10;
        const padding = 15; // Percent padding on each side
        const effectiveRangeX = rangeX + padding * 2;
        const effectiveRangeY = rangeY + padding * 2;

        // The map is 100% wide/high, so zoom = 100 / range
        const autoZoom = Math.min(100 / effectiveRangeX, 100 / effectiveRangeY);
        const clampedAutoZoom = Math.max(1, Math.min(5, autoZoom)); // Clamp between 1x and 5x

        // Calculate center of bounding box
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Pan to center the bounding box (offset from 50%,50%)
        // Pan values are in pixels, but we need to translate % offset to px based on container size.
        // For simplicity, we'll use percentage-based transform offset instead.
        const offsetX = (50 - centerX) * clampedAutoZoom;
        const offsetY = (50 - centerY) * clampedAutoZoom;

        return (
            <div
                className="map-container"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <div
                    className="map-content"
                    style={{
                        transform: `scale(${zoom !== 1 ? zoom : clampedAutoZoom}) translate(${pan.x !== 0 ? pan.x / zoom : offsetX}%, ${pan.y !== 0 ? pan.y / zoom : offsetY}%)`,
                        transformOrigin: 'center',
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    {nodes.map((node, i) => {
                        const isCurrent = gameState.currentPosition &&
                            node.x === gameState.currentPosition.x &&
                            node.y === gameState.currentPosition.y;
                        return (
                            <div
                                key={i}
                                className={`map-node ${node.status} ${isCurrent ? 'current' : ''}`}
                                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                title={`${node.name}\n${node.description}`}
                            >
                                <div className="node-icon"></div>
                                <span className="node-label">{node.name}</span>
                            </div>
                        );
                    })}
                    <div className="map-center" title="Start">+</div>
                </div>

                {/* Zoom Controls */}
                <div className="map-controls" style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                    <button onClick={() => setZoom(z => Math.min(5, (z === 1 ? clampedAutoZoom : z) + 0.5))}>+</button>
                    <button onClick={() => setZoom(z => Math.max(0.5, (z === 1 ? clampedAutoZoom : z) - 0.5))}>-</button>
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button>
                </div>
            </div>
        );
    };

    if (!gameState) return <div className="loading">Summoning the world...</div>;

    const lang = gameState.language || 'en';
    const text = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const char = gameState.character;

    return (
        <div className="game-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <button
                        className={`tab-btn ${viewMode === 'char' ? 'active' : ''}`}
                        onClick={() => setViewMode('char')}
                    >
                        {text.characterSheet}
                    </button>
                    <button
                        className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`}
                        onClick={() => setViewMode('map')}
                    >
                        {text.worldMap}
                    </button>
                </div>

                {viewMode === 'char' && (
                    <>
                        <div className="char-info">
                            <p><strong>{text.name}:</strong> {char.name}</p>
                            <div className="ingame-model-selector">
                                <p><strong>{text.gender}:</strong> {text.genders[char.gender] || char.gender}</p>
                            </div>
                            <p><strong>{text.race}:</strong> {text.races[char.race] || char.race}</p>
                            <p><strong>{text.class}:</strong> {text.classes[char.class] || char.class}</p>

                            {/* Resource Bars */}
                            {(char.hp !== undefined) && (
                                <div className="resource-bars">
                                    <div className="resource-bar">
                                        <div className="resource-label">{text.hp} {char.hp}/{char.maxHp}</div>
                                        <div className="bar-bg">
                                            <div
                                                className="bar-fill hp"
                                                style={{ width: `${(char.hp / char.maxHp) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="resource-bar">
                                        <div className="resource-label">{text.mp} {char.mp}/{char.maxMp}</div>
                                        <div className="bar-bg">
                                            <div
                                                className="bar-fill mp"
                                                style={{ width: `${(char.mp / char.maxMp) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            )}

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

                        {char.spells && char.spells.length > 0 && (
                            <div className="spells-section">
                                <h4>{text.spells}</h4>
                                <table className="spells-table">
                                    <thead>
                                        <tr>
                                            <th>{text.spellName}</th>
                                            <th>{text.cost}</th>
                                            <th>{text.effect}</th>
                                            <th>{text.prob}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {char.spells.map((spell, i) => (
                                            <tr key={i}>
                                                <td>{spell.name}</td>
                                                <td>{spell.cost}</td>
                                                <td>{spell.effect}</td>
                                                <td>{spell.prob}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {gameState.companions && gameState.companions.length > 0 && (
                            <div className="companions-section">
                                <h4>{text.companions}</h4>
                                <ul className="companions-list">
                                    {gameState.companions.map((comp, i) => (
                                        <li key={i}>
                                            <strong>{comp.name}</strong> ({comp.class})
                                            {comp.description && <div className="companion-desc">{comp.description}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="stats-list">
                            <h4>{text.stats}</h4>
                            <ul>
                                {Object.entries(char.stats).map(([key, val]) => (
                                    <li key={key}><strong>{text.statsLabels[key] || key.toUpperCase()}:</strong> {val}</li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {viewMode === 'map' && renderMap()}

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
