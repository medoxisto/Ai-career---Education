import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { UploadCloud, Search } from 'lucide-react';
import { OWNER_NAME } from '../config';

// Set up the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface CVInputProps {
  onCvTextExtracted: (text: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  searchButtonText?: string;
}

const CVInput: React.FC<CVInputProps> = ({ onCvTextExtracted, onSearch, isLoading, searchButtonText = 'Find Jobs' }) => {
  const [cvText, setCvText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCvText(text);
    onCvTextExtracted(text);
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (event) => {
      if (event.target?.result) {
        try {
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
            fullText += pageText + '\n';
          }
          setCvText(fullText);
          onCvTextExtracted(fullText);
        } catch (error) {
          console.error('Error parsing PDF:', error);
          alert('Failed to parse PDF file. Please ensure it is a valid PDF.');
          setFileName('');
        }
      }
    };

    reader.readAsArrayBuffer(file);
  }, [onCvTextExtracted]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl w-full">
      <h2 className="text-2xl font-bold text-white mb-4">1. Provide Your CV</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <textarea
          value={cvText}
          onChange={handleTextChange}
          placeholder="Paste your CV text here..."
          className="w-full h-64 p-4 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex flex-col items-center justify-center p-4 bg-gray-900 border-2 border-dashed border-gray-700 rounded-md">
          <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center text-gray-400 hover:text-blue-400 transition-colors">
            <UploadCloud size={48} />
            <span className="mt-2 text-center">
              {fileName ? fileName : 'Or upload a PDF'}
            </span>
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onSearch}
          disabled={!cvText || isLoading}
          data-owner={OWNER_NAME}
          className="relative flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2" size={20} />
              {searchButtonText}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CVInput;