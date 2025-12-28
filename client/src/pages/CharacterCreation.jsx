import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TRANSLATIONS = {
    en: {
        title: "Create Your Character",
        name: "Name",
        race: "Race",
        class: "Class",
        rollStats: "Roll Stats",
        embark: "Embark",
        dm: "DM",
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
        },
        stats: {
            str: "STR",
            dex: "DEX",
            con: "CON",
            int: "INT",
            wis: "WIS",
            cha: "CHA"
        }
    },
    fr: {
        title: "Créez Votre Personnage",
        name: "Nom",
        race: "Race",
        class: "Classe",
        rollStats: "Lancer les Dés",
        embark: "Commencer l'Aventure",
        dm: "MD",
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
        },
        stats: {
            str: "FOR",
            dex: "DEX",
            con: "CON",
            int: "INT",
            wis: "SAG",
            cha: "CHA"
        }
    }
};

function CharacterCreation() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedModel = location.state?.model;
    const language = location.state?.language || 'en'; // Default to en if missing

    const text = TRANSLATIONS[language] || TRANSLATIONS.en;

    const [formData, setFormData] = useState({
        name: '',
        race: 'Human',
        class: 'Fighter',
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateStats = () => {
        const roll = () => Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
        setFormData({
            ...formData,
            stats: {
                str: roll(), dex: roll(), con: roll(), int: roll(), wis: roll(), cha: roll()
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:3000/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character: formData,
                    model: selectedModel,
                    language: language // Pass language preference
                })
            });
            const data = await response.json();
            if (data.sessionId) {
                navigate(`/play/${data.sessionId}`);
            }
        } catch (error) {
            console.error("Failed to start game", error);
        }
    };

    return (
        <div className="creation-container">
            <h2>{text.title}</h2>
            {selectedModel && <div className="model-badge">{text.dm}: {selectedModel} ({language.toUpperCase()})</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{text.name}</label>
                    <input name="name" value={formData.name} onChange={handleChange} required />
                </div>

                <div className="form-group">
                    <label>{text.race}</label>
                    <select name="race" value={formData.race} onChange={handleChange}>
                        {Object.keys(TRANSLATIONS.en.races).map(raceKey => (
                            <option key={raceKey} value={raceKey}>
                                {text.races[raceKey]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{text.class}</label>
                    <select name="class" value={formData.class} onChange={handleChange}>
                        {Object.keys(TRANSLATIONS.en.classes).map(classKey => (
                            <option key={classKey} value={classKey}>
                                {text.classes[classKey]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="stats-section">
                    <button type="button" onClick={generateStats} className="btn-secondary">{text.rollStats}</button>
                    <div className="stats-grid">
                        {Object.entries(formData.stats).map(([key, val]) => (
                            <div key={key} className="stat-item">
                                <label>{text.stats[key] || key.toUpperCase()}</label>
                                <span>{val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="btn-primary">{text.embark}</button>
            </form>
        </div>
    );
}

export default CharacterCreation;
