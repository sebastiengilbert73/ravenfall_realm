import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Tiefling'];
const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin'];

function CharacterCreation() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedModel = location.state?.model; // Might be undefined if user navigated directly

    const [formData, setFormData] = useState({
        name: '',
        race: RACES[0],
        class: CLASSES[0],
        stats: {
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
        }
    });

    const [loading, setLoading] = useState(false);

    // If no model was selected (direct navigation), warn or assume default
    // Ideally, we redirect back to landing, but let's just proceed with server default

    const handleStatChange = (stat, value) => {
        setFormData(prev => ({
            ...prev,
            stats: { ...prev.stats, [stat]: parseInt(value) || 0 }
        }));
    };

    const rollStats = () => {
        const roll = () => Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
        setFormData(prev => ({
            ...prev,
            stats: {
                str: roll(), dex: roll(), con: roll(), int: roll(), wis: roll(), cha: roll()
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character: formData,
                    model: selectedModel // Send undefined if not set, server handles fallback
                })
            });

            const data = await response.json();
            if (data.sessionId) {
                navigate(`/play/${data.sessionId}`);
            }
        } catch (error) {
            console.error("Failed to start game", error);
            alert("Failed to connect to server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="creation-container">
            <h2>Create Your Character</h2>
            {selectedModel && <div className="model-badge">DM: {selectedModel}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name:</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Race:</label>
                    <select value={formData.race} onChange={e => setFormData({ ...formData, race: e.target.value })}>
                        {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label>Class:</label>
                    <select value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>
                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="stats-group">
                    <h3>Stats</h3>
                    <button type="button" onClick={rollStats}>Randomize Stats</button>
                    <div className="stats-grid">
                        {Object.keys(formData.stats).map(stat => (
                            <div key={stat} className="stat-item">
                                <label>{stat.toUpperCase()}:</label>
                                <input
                                    type="number"
                                    value={formData.stats[stat]}
                                    onChange={e => handleStatChange(stat, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Embarking...' : 'Begin Adventure'}
                </button>
            </form>
        </div>
    );
}

export default CharacterCreation;
