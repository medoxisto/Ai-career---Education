import React from 'react';
import { Job } from '../types';
import { Download, FileText, Mail, MapPin, Link as LinkIcon, AlertTriangle, Mic } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface JobsTableProps {
  jobs: Job[];
  onGenerateCv: (job: Job) => void;
  onStartInterview: (job: Job) => void;
}

const JobsTable: React.FC<JobsTableProps> = ({ jobs, onGenerateCv, onStartInterview }) => {
  if (!jobs.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mt-8 flex flex-col items-center justify-center min-h-[200px] shadow-xl">
        <FileText size={48} className="text-gray-500 mb-4" />
        <p className="text-gray-400">Job opportunities will appear here once you search.</p>
      </div>
    );
  }

  const getButtonTitle = (status: Job['status']) => {
    switch (status) {
      case 'New':
      case 'Error':
        return 'Generate ATS-Optimized CV';
      case 'CV Ready':
        return 'Download Tailored CV Again';
      case 'CV Generating':
        return 'Generating...';
      default:
        return '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mt-8 shadow-xl w-full">
      <h2 className="text-2xl font-bold text-white mb-4">2. Found Opportunities</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="p-4">Job Title</th>
              <th className="p-4">Company</th>
              <th className="p-4">Location</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="p-4 font-semibold text-blue-300">{job.title}</td>
                <td className="p-4">{job.company}</td>
                <td className="p-4">
                  {job.location ? (
                    <span className="flex items-center gap-2 text-gray-300">
                      <MapPin size={16} /> {job.location}
                    </span>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </td>
                <td className="p-4">
                  {job.email ? (
                    <a href={`mailto:${job.email}`} className="flex items-center gap-2 text-blue-400 hover:underline">
                      <Mail size={16} /> {job.email}
                    </a>
                  ) : (
                    <span className="text-gray-500">Not found</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full transition-colors" title="View Job Posting">
                      <LinkIcon size={18} />
                    </a>
                     <button
                        onClick={() => onStartInterview(job)}
                        className="p-2 text-gray-300 hover:text-white bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
                        title="Start Interview Training"
                      >
                        <Mic size={18} />
                      </button>
                    <button
                      onClick={() => onGenerateCv(job)}
                      disabled={job.status === 'CV Generating'}
                      className={`p-2 text-gray-300 hover:text-white rounded-full disabled:cursor-not-allowed transition-colors ${
                        job.status === 'CV Ready' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:bg-gray-500`}
                      title={getButtonTitle(job.status)}
                    >
                      {job.status === 'CV Generating' ? <LoadingSpinner size="sm" /> : <Download size={18} />}
                    </button>
                    {/* FIX: The `title` prop is not valid on lucide-react icons. Wrap the icon in a span with a title attribute for the tooltip. */}
                    {job.status === 'Error' && <span title="Error generating CV"><AlertTriangle size={18} className="text-red-500" /></span>}
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

export default JobsTable;