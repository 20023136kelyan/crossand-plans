
import {genkit, Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Extend Genkit type to include our enhanced generate function
interface EnhancedGenkit extends Genkit {
  enhancedGenerate: (params: any) => Promise<any>;
}

// Model configuration validation
const validateModelConfig = (config: any) => {
  if (!config.maxOutputTokens || config.maxOutputTokens < 1000) {
    console.warn('[Genkit Config] Warning: Low token limit may impact response quality');
  }
  if (!config.safetySettings) {
    console.warn('[Genkit Config] Warning: No safety settings configured');
  }
  // Ensure we're not hitting length limits
  if (config.maxOutputTokens > 30000) {
    console.warn('[Genkit Config] Warning: Token limit exceeds model maximum');
    config.maxOutputTokens = 30000;
  }
  return config;
};

// Default safety settings for text generation
export const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
];

// Location-specific safety settings (less restrictive for venue/location queries)
export const locationSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
];

// Task-specific configurations with retry logic
export const modelConfigs = {
  analysis: {
    temperature: 0.2,
    maxOutputTokens: 8000, // Increased to handle complex analysis
    safetySettings: defaultSafetySettings,
    candidateCount: 1,
    stopSequences: [],
    topK: 40,
    topP: 0.95
  },
  generation: {
    temperature: 0.4,
    maxOutputTokens: 8000,
    safetySettings: defaultSafetySettings,
    candidateCount: 1,
    stopSequences: [],
    topK: 40,
    topP: 0.95
  },
  creative: {
    temperature: 0.6,
    maxOutputTokens: 8000,
    safetySettings: defaultSafetySettings,
    candidateCount: 1,
    stopSequences: [],
    topK: 40,
    topP: 0.95
  },
  location: {
    temperature: 0.3,
    maxOutputTokens: 8000,
    safetySettings: locationSafetySettings,
    candidateCount: 1,
    stopSequences: [],
    topK: 40,
    topP: 0.95
  }
};

// Explicitly check for the Google AI API key for clearer error messaging if Genkit fails to start.
if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  const errorMessage = 
    " alerta: [Genkit Initialization] Environment variable GOOGLE_API_KEY or GEMINI_API_KEY is not set. " +
    "The Google AI plugin for Genkit requires this to function. " +
    "If the Genkit dev server (e.g., 'npm run genkit:dev') is failing to start or repeatedly shutting down, " +
    "this is a likely cause. Please ensure the API key is correctly set in your .env file " +
    "and that the .env file is being loaded by the Genkit process.";
  console.warn(errorMessage);
}

// Retry logic for API calls
const retryWithExponentialBackoff = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[Genkit] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Enhanced generate function with validation and retry logic
const enhancedGenerate = async (params: any) => {
  const config = validateModelConfig(params.config || {});
  
  // Ensure we have a proper prompt
  if (!params.prompt || typeof params.prompt !== 'string') {
    throw new Error('[Genkit] Invalid prompt format');
  }
  
  return retryWithExponentialBackoff(async () => {
    const response = await ai.generate({
      ...params,
      config: {
        ...modelConfigs.analysis, // Default to analysis config
        ...config,
        safetySettings: config.safetySettings || defaultSafetySettings
      }
    });
    
    // Validate response
    if (!response || !response.message || !response.message.content) {
      throw new Error('[Genkit] Empty or invalid response from model');
    }
    
    return response;
  });
};

// Create and configure the Genkit instance with enhanced functionality
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-pro'
}) as EnhancedGenkit;

// Attach the enhanced generate function
ai.enhancedGenerate = enhancedGenerate;
