import React, { useState, useCallback } from 'react';
import { Concours } from '../types';
import CVInput from './CVInput';
import ConcoursTable from './ConcoursTable';
import LoadingSpinner from './LoadingSpinner';
import ConcoursTrainer from './ConcoursTrainer';
import { findMasterConcours, findPreviousExams } from '../services/geminiService';
import { MapPin } from 'lucide-react';

const ConcoursFinder: React.FC = () => {
  const [cvText, setCvText] = useState('');
  const [location, setLocation] = useState('');
  const [concoursList, setConcoursList] = useState<Concours[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // State for preparing the trainer
  const [trainingConcours, setTrainingConcours] = useState<Concours | null>(null);
  const [isPreparingTrainer, setIsPreparingTrainer] = useState(false);
  const [previousExamsText, setPreviousExamsText] = useState('');


  const handleSearch = useCallback(async () => {
    if (!cvText || !location) {
      setError('Please provide your CV text and a location.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Analyzing CV and searching for Master Concours...');
    setError(null);
    setConcoursList([]);

    try {
      const foundConcours = await findMasterConcours(cvText, location);
      const concoursWithIds = foundConcours.map((concours: any, index: number) => ({
        ...concours,
        id: `${Date.now()}-${index}`,
        status: 'New',
      } as Concours));
      setConcoursList(concoursWithIds);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [cvText, location]);
  
  const handleStartTraining = useCallback(async (concours: Concours) => {
    setIsPreparingTrainer(true);
    try {
        const examHistory = await findPreviousExams(concours.title, concours.university);
        setPreviousExamsText(examHistory);
        setTrainingConcours(concours);
    } catch (e: any) {
        setError("Could not fetch historical exam data. Starting trainer with limited context.");
        setPreviousExamsText("No historical data available.");
        setTrainingConcours(concours);
    } finally {
        setIsPreparingTrainer(false);
    }
  }, []);

  const handleCloseTraining = () => {
    setTrainingConcours(null);
    setPreviousExamsText('');
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
      {trainingConcours && (
        <ConcoursTrainer 
            concours={trainingConcours} 
            cvText={cvText}
            previousExamsText={previousExamsText}
            onClose={handleCloseTraining} 
        />
      )}
      <p className="text-center text-lg text-gray-400">
        Provide your CV and a target country or city. Our AI will find relevant Master's program competitive exams and help you train for them.
      </p>
      
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg w-full">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6 shadow-xl w-full">
        <h2 className="text-2xl font-bold text-white mb-4">2. Specify Location</h2>
         <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter Country or City..."
            className="w-full bg-gray-900 border border-gray-700 rounded-md p-3 pl-10 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            disabled={isLoading || isPreparingTrainer}
          />
        </div>
      </div>

      <CVInput 
        onCvTextExtracted={setCvText}
        onSearch={handleSearch}
        isLoading={isLoading || isPreparingTrainer}
        searchButtonText="Find Concours"
      />
      
      {(isLoading || isPreparingTrainer) && !concoursList.length && (
        <div className="w-full flex justify-center p-8">
          <LoadingSpinner text={isPreparingTrainer ? 'Compiling historical exam data...' : loadingMessage} />
        </div>
      )}

      <ConcoursTable 
        concoursList={concoursList} 
        onStartTraining={handleStartTraining} 
        isPreparingTrainer={isPreparingTrainer}
      />
    </div>
  );
};

export default ConcoursFinder;