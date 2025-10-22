import React from 'react';
import { Concours } from '../types';
import { GraduationCap, BookOpen, Link as LinkIcon, Calendar, Mic } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface ConcoursTableProps {
  concoursList: Concours[];
  onStartTraining: (concours: Concours) => void;
  isPreparingTrainer: boolean;
}

const ConcoursTable: React.FC<ConcoursTableProps> = ({ concoursList, onStartTraining, isPreparingTrainer }) => {
  if (!concoursList.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mt-8 flex flex-col items-center justify-center min-h-[200px] shadow-xl">
        <BookOpen size={48} className="text-gray-500 mb-4" />
        <p className="text-gray-400">Concours opportunities will appear here once you search.</p>
      </div>
    );
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return <span className="text-gray-500">N/A</span>;
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString; // Return original string if it's not a valid date
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mt-8 shadow-xl w-full">
      <h2 className="text-2xl font-bold text-white mb-4">3. Found Concours</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="p-4">Concours Title</th>
              <th className="p-4">University</th>
              <th className="p-4">Dates</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {concoursList.map((concours) => (
              <tr key={concours.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="p-4 font-semibold text-purple-300">{concours.title}</td>
                <td className="p-4">
                  <span className="flex items-center gap-2">
                    <GraduationCap size={16} /> {concours.university}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  <div className="flex flex-col gap-1">
                      <p className="flex items-center gap-2">
                          <span className="font-semibold w-20">Apply By:</span>
                          {formatDate(concours.applicationDeadline)}
                      </p>
                      <p className="flex items-center gap-2">
                          <span className="font-semibold w-20">Exam Date:</span>
                          {formatDate(concours.examDate)}
                      </p>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <a href={concours.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full transition-colors" title="View Concours Details">
                      <LinkIcon size={18} />
                    </a>
                     <button
                        onClick={() => onStartTraining(concours)}
                        disabled={isPreparingTrainer}
                        className="p-2 w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white bg-purple-600 hover:bg-purple-700 rounded-full transition-colors disabled:bg-gray-500 disabled:cursor-wait"
                        title="Start Training Session"
                      >
                        {isPreparingTrainer ? <LoadingSpinner size="sm" /> : <Mic size={18} />}
                      </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConcoursTable;