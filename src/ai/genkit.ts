
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Explicitly check for the Google AI API key for clearer error messaging if Genkit fails to start.
// The googleAI() plugin itself will also check and throw an error, but this warning aims to be more direct.
if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  const errorMessage = 
    " alerta: [Genkit Initialization] Environment variable GOOGLE_API_KEY or GEMINI_API_KEY is not set. " +
    "The Google AI plugin for Genkit requires this to function. " +
    "If the Genkit dev server (e.g., 'npm run genkit:dev') is failing to start or repeatedly shutting down, " +
    "this is a likely cause. Please ensure the API key is correctly set in your .env file " +
    "and that the .env file is being loaded by the Genkit process.";
  console.warn(errorMessage);
  // Note: The googleAI() plugin will ultimately throw an error if the key is missing
  // when it attempts to initialize, which should stop the 'genkit start' process
  // and provide its own error message. This warning is an additional diagnostic aid.
}

export const ai = genkit({
  plugins: [
    googleAI(), // The googleAI plugin will handle the actual API key check.
  ],
  // It's generally recommended to specify the model per-flow or per-generate call
  // rather than a global default model if you plan to use different models (e.g., for image generation).
  model: 'googleai/gemini-2.5-pro', 
});
