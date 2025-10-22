import React, { useState } from 'react';
import { Bot, Github, ArrowLeft } from 'lucide-react';
import ModeSelector from './components/ModeSelector';
import JobHunter from './components/JobHunter';
import ConcoursFinder from './components/ConcoursFinder';
import { OWNER_NAME } from './config';

const App: React.FC = () => {
  const [mode, setMode] = useState<'unselected' | 'job' | 'concours'>('unselected');

  const renderContent = () => {
    switch (mode) {
      case 'job':
        return <JobHunter />;
      case 'concours':
        return <ConcoursFinder />;
      case 'unselected':
      default:
        return <ModeSelector onSelectMode={setMode} />;
    }
  };
  
  const getTitle = () => {
     switch (mode) {
      case 'job':
        return "AI Job Hunter";
      case 'concours':
        return "Master's Concours Finder";
      case 'unselected':
      default:
        return "AI Career & Education Tool";
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="bg-gray-800/50 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {mode !== 'unselected' && (
              <button onClick={() => setMode('unselected')} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                <ArrowLeft size={24} />
              </button>
            )}
            <Bot size={32} className="text-blue-400" />
            <h1 className="text-2xl font-bold text-white">{getTitle()}</h1>
          </div>
          <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <Github size={24} />
          </a>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>

      <footer className="text-center p-4 text-gray-500 text-sm border-t border-gray-800 mt-12">
        <p>Powered by Google Gemini API. Created by <span className="font-bold text-gray-400">{OWNER_NAME}</span>.</p>
      </footer>
    </div>
  );
};

export default App;
