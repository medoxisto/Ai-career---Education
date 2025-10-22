import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const findJobsForCv = async (cvText: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following CV, find 5 relevant and recent job postings using Google Search. Return the results as a JSON array inside a \`\`\`json markdown block. Each object in the array should have the following keys: "title", "company", "description", and "url". Do not include any other text outside of this JSON block. CV: """${cvText}"""`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text;
    
    if (!rawText) {
      console.error("The model's response was empty or did not contain text.", { response });
      if (response?.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error("The request was blocked due to safety concerns. Please modify your CV text and try again.");
      }
      throw new Error("The model returned an empty response for job search. Please try again.");
    }

    // Regex to find JSON within ```json ... ```, accounting for potential newlines
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);

    let jobsJson;
    if (jsonMatch && jsonMatch[1]) {
      jobsJson = JSON.parse(jsonMatch[1]);
    } else {
       // Fallback for cases where the model returns raw JSON without markdown fences
      try {
        jobsJson = JSON.parse(rawText);
      } catch (e) {
        console.error("Failed to parse JSON from model response:", rawText);
        throw new Error("The model returned an invalid format for job listings.");
      }
    }
     return jobsJson;

  } catch (error) {
    console.error("Error finding jobs:", error);
    if (error instanceof Error && (error.message.includes("invalid format") || error.message.includes("empty response") || error.message.includes("safety concerns"))) {
        throw error;
    }
    throw new Error("Failed to find jobs. Please try again later.");
  }
};

export const findMasterConcours = async (cvText: string, location: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following CV and location "${location}", find up to 5 relevant Master's program competitive exams (concours). Use Google Search. Return the results as a JSON array inside a \`\`\`json markdown block. Each object must have: "title", "university", "description", "url". Optionally include "applicationDeadline" and "examDate" if available. Do not include any other text. CV: """${cvText}"""`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const rawText = response.text;
     if (!rawText) {
      console.error("The model's response was empty for concours search.", { response });
      throw new Error("The model returned an empty response for concours search. Please try again.");
    }

    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    } else {
      try {
        return JSON.parse(rawText);
      } catch (e) {
        console.error("Failed to parse JSON from model response for concours:", rawText);
        throw new Error("The model returned an invalid format for concours listings.");
      }
    }
  } catch (error) {
    console.error("Error finding master concours:", error);
    if (error instanceof Error && (error.message.includes("invalid format") || error.message.includes("empty response"))) {
        throw error;
    }
    throw new Error("Failed to find master concours. Please try again later.");
  }
};


export const findCompanyInfo = async (companyName: string) => {
  try {
    // Find Location
    const locationPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `What is the primary headquarters location or city for the company "${companyName}"? Respond with only the city and country.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    // Find Email
    const emailPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find a general inquiry or HR contact email address for the company "${companyName}". If you cannot find one, respond with "N/A".`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const [locationResponse, emailResponse] = await Promise.all([locationPromise, emailPromise]);

    const location = locationResponse.text.trim();
    let email = emailResponse.text.trim();
    if (email.toLowerCase() === 'n/a' || !email.includes('@')) {
      email = '';
    }
    
    return { location, email };
  } catch (error) {
    console.error(`Error finding info for ${companyName}:`, error);
    return { location: 'Not found', email: '' };
  }
};

export const generateAtsCv = async (cvText: string, jobDescription: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are a world-class resume writer specializing in optimizing CVs for Applicant Tracking Systems (ATS).
      Your task is to rewrite the provided CV to perfectly match the given job description.
      - Incorporate keywords from the job description naturally.
      - Quantify achievements with metrics wherever possible.
      - Use a clean, professional, and easily parsable format.
      - The output should be the full text of the tailored CV and nothing else. No introductory text or comments.

      ORIGINAL CV:
      """
      ${cvText}
      """

      JOB DESCRIPTION:
      """
      ${jobDescription}
      """`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error generating ATS CV:", error);
    throw new Error("Failed to generate the tailored CV.");
  }
};

export const findPreviousExams = async (title: string, university: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Using Google Search, find information, summaries, or actual questions from previous years' competitive exams (concours) for the '${title}' at ${university}. Consolidate all relevant findings into a single, comprehensive block of text. If no specific information is found, provide a general overview of what such an exam typically covers.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error finding previous exams:", error);
    return "Could not retrieve information about previous exams.";
  }
};


export const generateMockConcours = async (concoursTitle: string, university: string, description: string, cvText: string, previousExamsText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are an expert academic exam creator. Your task is to generate a full, realistic mock competitive exam (concours) for the "${concoursTitle}" program at ${university}.

      Base the structure, question types, topics, and difficulty level on the provided description and the consolidated information from previous exams. Where relevant, tailor some questions to the candidate's background, as detailed in their CV.

      The output must be a well-formatted and comprehensive exam paper written in Markdown.
      - Use standard Markdown for all text formatting (headings, lists, bold, etc.).
      - For mathematical formulas and equations, use LaTeX syntax. Wrap inline math with single dollar signs (e.g., $E=mc^2$) and block-level equations with double dollar signs (e.g., $$ \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi} $$).
      - For code snippets or programming questions, use fenced code blocks with the appropriate language identifier (e.g., \`\`\`python ... \`\`\`).
      
      It should include clear sections, question numbering, and instructions for the student. Do not include any introductory text or comments outside of the exam paper itself.

      EXAM DESCRIPTION:
      """
      ${description}
      """

      CANDIDATE'S CV:
      """
      ${cvText}
      """

      INFORMATION FROM PREVIOUS EXAMS:
      """
      ${previousExamsText}
      """
      `,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error generating mock concours:", error);
    throw new Error("Failed to generate the mock exam.");
  }
};