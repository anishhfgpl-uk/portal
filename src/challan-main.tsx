import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChallanManager } from './components/ChallanManager';
import './index.css';

createRoot(document.getElementById('root')!).render(<ChallanManager onClose={() => { window.location.href = '/'; }} />);
