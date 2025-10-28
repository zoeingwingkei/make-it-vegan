export async function runPrompt(prompt, systemPromt, session) {
    const params = {
        initialPrompts: [
            { role: 'system', content: systemPromt }
        ],
        temperature: 0.1,
        topK: 1,
        outputLanguage: 'en',
    }
    try {
        if (!session) {
            session = await LanguageModel.create(params);
        }
        return session.prompt(prompt);

    } catch (error) {
        console.error('Error running prompt:', error);
        throw error;
    }
}