import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TRANSLATIONS = {
    en: {
        title: "Create Your Character",
        name: "Name",
        gender: "Gender",
        race: "Race",
        class: "Class",
        rollStats: "Roll Stats",
        embark: "Embark",
        embarking: "Embarking...",
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
        genders: {
            Male: "Male",
            Female: "Female",
            NonBinary: "Non-binary",
            Other: "Other"
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
        gender: "Genre",
        race: "Race",
        class: "Classe",
        rollStats: "Lancer les Dés",
        embark: "Commencer l'Aventure",
        embarking: "Lancement...",
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
        genders: {
            Male: "Homme",
            Female: "Femme",
            NonBinary: "Non-binaire",
            Other: "Autre"
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

const CLASS_SPELLS = {
    en: {
        Wizard: [
            { name: "Fire Bolt", cost: "Cantrip", effect: "1d10 Fire Dmg", prob: "+5 Hit" },
            { name: "Magic Missile", cost: "1 Slot", effect: "3x(1d4+1) Force", prob: "Auto" },
            { name: "Shield", cost: "1 Slot", effect: "+5 AC Reaction", prob: "Self" }
        ],
        Cleric: [
            { name: "Sacred Flame", cost: "Cantrip", effect: "1d8 Radiant", prob: "DC 13 DEX" },
            { name: "Cure Wounds", cost: "1 Slot", effect: "1d8+3 Heal", prob: "Touch" },
            { name: "Guiding Bolt", cost: "1 Slot", effect: "4d6 Radiant", prob: "+5 Hit" }
        ],
        Paladin: [
            { name: "Lay on Hands", cost: "Pool", effect: "Heal HP", prob: "Touch" },
            { name: "Divine Smite", cost: "1 Slot", effect: "+2d8 Radiant", prob: "On Hit" }
        ],
        Fighter: [],
        Rogue: []
    },
    fr: {
        Wizard: [
            { name: "Trait de Feu", cost: "Cantrip", effect: "1d10 Feu", prob: "+5 Touché" },
            { name: "Projectile Magique", cost: "1 Emplac.", effect: "3x(1d4+1) Force", prob: "Auto" },
            { name: "Bouclier", cost: "1 Emplac.", effect: "+5 CA Réaction", prob: "Soi" }
        ],
        Cleric: [
            { name: "Flamme Sacrée", cost: "Cantrip", effect: "1d8 Radiant", prob: "DD 13 DEX" },
            { name: "Soins", cost: "1 Emplac.", effect: "1d8+3 Soin", prob: "Contact" },
            { name: "Éclat Guidant", cost: "1 Emplac.", effect: "4d6 Radiant", prob: "+5 Touché" }
        ],
        Paladin: [
            { name: "Imposition des mains", cost: "Réserve", effect: "Soin PV", prob: "Contact" },
            { name: "Châtiment Divin", cost: "1 Emplac.", effect: "+2d8 Radiant", prob: "Au Touché" }
        ],
        Fighter: [],
        Rogue: []
    }
};

function CharacterCreation() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedModel = location.state?.model;
    const language = location.state?.language || 'en';

    const text = TRANSLATIONS[language] || TRANSLATIONS.en;

    const [isEmbarking, setIsEmbarking] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gender: 'Male',
        race: 'Human',
        class: 'Fighter',
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        spells: []
    });

    // Update spells when class changes
    useEffect(() => {
        const spellSet = CLASS_SPELLS[language] || CLASS_SPELLS.en;
        setFormData(prev => ({
            ...prev,
            spells: spellSet[prev.class] || []
        }));
    }, [formData.class, language]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateStats = () => {
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
        if (isEmbarking) return;

        setIsEmbarking(true);
        try {
            // Calculate Modifiers
            const getMod = (score) => Math.floor((score - 10) / 2);
            const conMod = getMod(formData.stats.con);

            // Base HP by Class (Level 1)
            const hitDie = {
                Fighter: 10, Paladin: 10,
                Cleric: 8, Rogue: 8,
                Wizard: 6
            };
            const baseHp = (hitDie[formData.class] || 8) + conMod;
            const finalHp = Math.max(1, baseHp); // Minimum 1 HP

            // Base MP (Simplified for "Mana Points" request)
            // Casters get reasonable starting pool, others 0
            const msgMpValues = {
                Wizard: 10, Cleric: 8, Paladin: 4,
                Fighter: 0, Rogue: 0
            };
            const baseMp = msgMpValues[formData.class] || 0;

            // Ensure spells are attached 
            const spellSet = CLASS_SPELLS[language] || CLASS_SPELLS.en;
            const finalSpells = spellSet[formData.class] || [];

            const characterPayload = {
                ...formData,
                hp: finalHp,
                maxHp: finalHp,
                mp: baseMp,
                maxMp: baseMp,
                spells: finalSpells
            };

            const response = await fetch('http://localhost:3000/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character: characterPayload,
                    model: selectedModel,
                    language: language
                })
            });
            const data = await response.json();
            if (data.sessionId) {
                navigate(`/play/${data.sessionId}`);
            } else {
                setIsEmbarking(false);
            }
        } catch (error) {
            console.error("Failed to start game", error);
            setIsEmbarking(false);
        }
    };

    return (
        <div className="creation-container">
            <h2>{text.title}</h2>
            {selectedModel && <div className="model-badge">{text.dm}: {selectedModel} ({language.toUpperCase()})</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{text.name}</label>
                    <input name="name" value={formData.name} onChange={handleChange} required disabled={isEmbarking} />
                </div>

                <div className="form-group">
                    <label>{text.gender}</label>
                    <select name="gender" value={formData.gender} onChange={handleChange} disabled={isEmbarking}>
                        {Object.keys(TRANSLATIONS.en.genders).map(genderKey => (
                            <option key={genderKey} value={genderKey}>
                                {text.genders[genderKey]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{text.race}</label>
                    <select name="race" value={formData.race} onChange={handleChange} disabled={isEmbarking}>
                        {Object.keys(TRANSLATIONS.en.races).map(raceKey => (
                            <option key={raceKey} value={raceKey}>
                                {text.races[raceKey]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{text.class}</label>
                    <select name="class" value={formData.class} onChange={handleChange} disabled={isEmbarking}>
                        {Object.keys(TRANSLATIONS.en.classes).map(classKey => (
                            <option key={classKey} value={classKey}>
                                {text.classes[classKey]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="stats-section">
                    <button type="button" onClick={generateStats} className="btn-secondary" disabled={isEmbarking}>{text.rollStats}</button>
                    <div className="stats-grid">
                        {Object.entries(formData.stats).map(([key, val]) => (
                            <div key={key} className="stat-item">
                                <label>{text.stats[key] || key.toUpperCase()}</label>
                                <span>{val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    className={`btn-primary ${isEmbarking ? 'loading-btn' : ''}`}
                    disabled={isEmbarking}
                >
                    {isEmbarking ? (
                        <span className="spinner-text">
                            <span className="spinner"></span> {text.embarking}
                        </span>
                    ) : (
                        text.embark
                    )}
                </button>
            </form>
        </div>
    );
}

export default CharacterCreation;
