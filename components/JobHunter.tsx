import React, { useState, useCallback } from 'react';
import { Job } from '../types';
import CVInput from './CVInput';
import JobsTable from './JobsTable';
import LoadingSpinner from './LoadingSpinner';
import InterviewTrainer from './InterviewTrainer';
import { findJobsForCv, findCompanyInfo, generateAtsCv } from '../services/geminiService';
import { generatePdfFromText } from '../services/pdfService';

const JobHunter: React.FC = () => {
  const [cvText, setCvText] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trainingJob, setTrainingJob] = useState<Job | null>(null);

  const handleSearch = useCallback(async () => {
    if (!cvText) {
      setError('Please provide your CV text first.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Analyzing your CV and searching for jobs...');
    setError(null);
    setJobs([]);

    try {
      const foundJobs = await findJobsForCv(cvText);
      setLoadingMessage('Found jobs! Fetching company details...');
      
      const jobsWithInfo = await Promise.all(
        foundJobs.map(async (job: any, index: number) => {
          const { location, email } = await findCompanyInfo(job.company);
          return {
            ...job,
            id: `${Date.now()}-${index}`,
            location,
            email,
            status: 'New',
          } as Job;
        })
      );

      setJobs(jobsWithInfo);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [cvText]);
  
  const handleGenerateCv = useCallback(async (jobToUpdate: Job) => {
    const fileName = `CV_${jobToUpdate.company.replace(/\s/g, '_')}_${jobToUpdate.title.replace(/\s/g, '_')}`;

    if (jobToUpdate.status === 'CV Ready' && jobToUpdate.tailoredCv) {
      generatePdfFromText(jobToUpdate.tailoredCv, fileName);
      return;
    }

    setJobs(prevJobs => prevJobs.map(j => j.id === jobToUpdate.id ? { ...j, status: 'CV Generating' } : j));

    try {
      const tailoredCvText = await generateAtsCv(cvText, jobToUpdate.description);
      generatePdfFromText(tailoredCvText, fileName);
      setJobs(prevJobs => prevJobs.map(j => 
        j.id === jobToUpdate.id 
        ? { ...j, status: 'CV Ready', tailoredCv: tailoredCvText } 
        : j
      ));
    } catch (e) {
      console.error("Failed to generate CV", e);
      setJobs(prevJobs => prevJobs.map(j => j.id === jobToUpdate.id ? { ...j, status: 'Error' } : j));
    }
  }, [cvText]);
  
  const handleStartInterview = (job: Job) => {
    setTrainingJob(job);
  };

  const handleCloseInterview = () => {
    setTrainingJob(null);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
      {trainingJob && <InterviewTrainer job={trainingJob} onClose={handleCloseInterview} />}
      <p className="text-center text-lg text-gray-400">
        Paste your CV or upload a PDF. Our AI will find relevant jobs, gather company info, and craft a tailored, ATS-friendly resume for each application.
      </p>
      
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg w-full">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      <CVInput 
        onCvTextExtracted={setCvText}
        onSearch={handleSearch}
        isLoading={isLoading}
      />
      
      {isLoading && !jobs.length && (
        <div className="w-full flex justify-center p-8">
          <LoadingSpinner text={loadingMessage} />
        </div>
      )}

      <JobsTable jobs={jobs} onGenerateCv={handleGenerateCv} onStartInterview={handleStartInterview} />
    </div>
  );
};

export default JobHunter;
