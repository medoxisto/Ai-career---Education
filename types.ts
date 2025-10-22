export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  location?: string;
  email?: string;
  status: 'New' | 'CV Generating' | 'CV Ready' | 'Error';
  tailoredCv?: string;
}

export interface TranscriptEntry {
  speaker: 'user' | 'model';
  text: string;
}

export interface Concours {
  id: string;
  title: string;
  university: string;
  description: string;
  applicationDeadline?: string;
  examDate?: string;
  url: string;
  status: 'New' | 'Training';
}
