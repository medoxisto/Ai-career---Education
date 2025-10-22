import React from 'react';
import { Briefcase, GraduationCap } from 'lucide-react';
import { OWNER_NAME } from '../config';

interface ModeSelectorProps {
  onSelectMode: (mode: 'job' | 'concours') => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode }) => {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center gap-8 text-center">
        <h2 className="text-3xl font-bold text-white">Welcome!</h2>
        <p className="text-lg text-gray-400">
            What would you like to do today? Choose a path to get started.
        </p>
        <div className="w-full grid md:grid-cols-2 gap-8 mt-4">
            {/* Job Hunter Card */}
            <button
                onClick={() => onSelectMode('job')}
                data-owner={OWNER_NAME}
                className="relative group bg-gray-800 p-8 rounded-lg border-2 border-transparent hover:border-blue-500 hover:bg-gray-800/50 transition-all duration-300 transform hover:-translate-y-2 shadow-lg hover:shadow-2xl"
            >
                <div className="flex flex-col items-center">
                    <Briefcase size={64} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
                    <h3 className="mt-4 text-2xl font-bold text-white">Job Hunter</h3>
                    <p className="mt-2 text-gray-400">Find jobs, get company info, and generate tailored, ATS-friendly CVs.</p>
                </div>
            </button>

            {/* Concours Finder Card */}
            <button
                onClick={() => onSelectMode('concours')}
                data-owner={OWNER_NAME}
                className="relative group bg-gray-800 p-8 rounded-lg border-2 border-transparent hover:border-purple-500 hover:bg-gray-800/50 transition-all duration-300 transform hover:-translate-y-2 shadow-lg hover:shadow-2xl"
            >
                <div className="flex flex-col items-center">
                    <GraduationCap size={64} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                    <h3 className="mt-4 text-2xl font-bold text-white">Master's Concours Finder</h3>
                    <p className="mt-2 text-gray-400">Discover competitive master's exams and train for them with an AI tutor.</p>
                </div>
            </button>
        </div>
    </div>
  );
};

export default ModeSelector;