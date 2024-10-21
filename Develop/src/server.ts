import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { StructuredOutputParser, OutputFixingParser } from 'langchain/output_parsers';

dotenv.config();

const port = process.env.PORT || 3001;
const apiKey = process.env.OPENAI_API_KEY;

// Check if the API key is defined
if (!apiKey) {
  console.error('OPENAI_API_KEY is not defined. Exiting...');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Initialize the OpenAI model
const model = new OpenAI({
  temperature: 0,   // the randomness of the output (0 is NOT creative, 1 is VERY creative)
  openAIApiKey: apiKey,   // the API key for OpenAI
  modelName: "gpt-3.5-turbo",   // the model to use
})

// Define the parser for the structured output
const parser = StructuredOutputParser.fromZodSchema(z.object({
  day1: z.string(),
  day2: z.string(),
  day3: z.string(),
  day4: z.string(),
  day5: z.string(), 
}).describe("A JSON object with the forecast for the next 5 days"));


// Get the format instructions from the parser
const outputFixingParser = OutputFixingParser.fromLLM(model, parser);
const formatInstructions = outputFixingParser.getFormatInstructions();

// Define the prompt template (what goes into the LLM model)
// This is the prompt that will be used to generate the output
// The input variables are the variables that will be replaced with the user input
// make sure the input variables match the input variables in the prompt (i.e. {location})
const promptTemplate = new PromptTemplate({
  template: 'You are a sports announcer. Provide an exciting and energetic play-by-play of the weather forecast for {location}. Make it sound like a thrilling sports commentary! Return the forcast as a JSON object with each day forecast as a property. The keys should be "date-day1", "day-of-the-week-day1", "day1", "date-day2", "day-of-the-week-day2", "day2", "date-day3", "day-of-the-week-day3", "day3", "date-day4", "day-of-the-week-day4", "day4", "date-day5", "day-of-the-week-day5", "day5". The JSON should be properly formatted. The first day should be today.',
  inputVariables: ['location'],
  partialVariables: {format_instructions: formatInstructions},
});


// Create a prompt function that takes the user input and passes it through the call method
const promptFunc = async (input: string) => {

  try{
    // Format the prompt with the user input
    const promptInput = await promptTemplate.format({location: input});
    // Call the model with the formatted prompt
    const res = await model.invoke(promptInput);
    // return the JSON response
    if (typeof res === 'string') {
      return JSON.parse(res);
    }
    return res;

    // TODO: Catch any errors and log them to the console
  } catch (error) {
    console.error('Error:', error);
    // console.error('Error: ${e.message}');
    throw error;
};
}


// Endpoint to handle request
// req.body.location is the location that the user wants the forecast for
app.post('/forecast', async (req: Request, res: Response): Promise<void> => {
  try {
    const location: string = req.body.location;
    // Check if the location is provided
    // If not, return an error
    if (!location) {
      res.status(400).json({
        error: 'Please provide a location in the request body.',
      });
    }
    // Call the prompt function with the location
    const result: any = await promptFunc(location);
    // Return the result to the user from the prompt function
    res.json({ result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      // console.error('Error: ${e.message}');
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
