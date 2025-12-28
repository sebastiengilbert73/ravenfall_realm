import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import CharacterCreation from './pages/CharacterCreation';
import GameSession from './pages/GameSession';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CharacterCreation />} />
          <Route path="/play/:sessionId" element={<GameSession />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
