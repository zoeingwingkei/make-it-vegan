
const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');
const recipeDataElement = document.body.querySelector('#recipe-container');
const noRecipeFoundElement = document.body.querySelector('#no-recipe-found');
const recipeIngredientsElement = document.body.querySelector('#recipe-ingredients');
const recipeStepsElement = document.body.querySelector('#recipe-steps');
const veganTagElement = document.body.querySelector('#vegan-tag');

const checkVeganButton = document.body.querySelector('#button-check-vegan');
const makeVeganButton = document.body.querySelector('#button-make-vegan');
const refreshButton = document.body.querySelector('#button-fresh');

const systemPrompt = "You are a helpful assistant that determines whether a recipe is vegan based on its ingredients. A vegan recipe contains no animal products, including meat, dairy, eggs, honey, or any other animal-derived ingredients. When given a list of ingredients, respond with 'True' if all ingredients are vegan, or 'False' if any animal products are present.";
const classifyPrompt = `You are a vegan recipe classifier. Analyze the ingredient list and determine if the recipe can be converted to vegan by substituting non-vegan ingredients with readily available vegan alternatives.

Output only: True or False

True if:
- Non-vegan ingredients have common vegan substitutes (e.g., milk→plant milk, eggs→flax eggs, butter→vegan butter, meat→tofu/tempeh/beans, cheese→vegan cheese, honey→maple syrup)
- Recipe structure remains intact after substitution

False if:
- Core ingredient is irreplaceable (e.g., egg-based meringue, cheese fondue, steak tartare)
- Recipe fundamentally relies on animal product properties

Respond with only one word: True or False`;
const convertPrompt = `You convert recipe ingredients to vegan by identifying non-vegan items and marking substitutions.

Non-vegan: any meat (beef, pork, chicken, turkey, lamb), seafood, eggs, dairy (milk, cream, butter, cheese, yogurt, sour cream), honey, gelatin, lard.

Output format: JSON object with "vegan_recipe" array containing ALL ingredients as strings.

Rules:
- For non-vegan ingredients: keep measurements, wrap ONLY the ingredient name in <del></del> tags, add " → [vegan substitute]"
- Keep vegan ingredients unchanged
- Maintain original measurements and preparation details
- Output ONLY valid JSON, no extra text

Input:
["2 eggs", "1 cup flour", "1/2 cup butter"]

Output:
{
  "vegan_recipe": [
    "2 <del>eggs</del> → [flax eggs]",
    "1 cup flour",
    "1/2 cup <del>butter</del> → [vegan butter]"
  ]
}`;

let session;


async function updateRecipeDisplay(recipeData) {
  // Function check to ensure recipeData is valid
  function isValidRecipe(data) {
    if (!data) return false;
    if (data.title == "Title Not Found") return false;
    if (data.ingredients.length === 0 || data.ingredients[0] === "Ingredients Not Found") return false;
    if (data.steps.length === 0 || data.steps[0] === "Steps Not Found") return false;
    return true;
  }

  if (!isValidRecipe(recipeData)) {
    recipeDataElement.hidden = true;
    noRecipeFoundElement.hidden = false;
    refreshButton.hidden = false;
    checkVeganButton.hidden = true;
    return;
  }

  // Show the recipe data elements
  recipeDataElement.hidden = false;
  noRecipeFoundElement.hidden = true;
  refreshButton.hidden = true;
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  recipeStepsElement.innerHTML = ''; // Clear previous steps
  veganTagElement.innerText = ''; // Clear previous tag state
  checkVeganButton.hidden = false;
  makeVeganButton.hidden = true;
  recipeData.ingredients.forEach(ingredient => {
    const li = document.createElement('li');
    li.textContent = ingredient;
    recipeIngredientsElement.appendChild(li);
  });
  recipeData.steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    recipeStepsElement.appendChild(li);
  });

}

async function runPrompt(prompt, params) {
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

function startLoading() {
  checkVeganButton.disabled = true;
  checkVeganButton.innerText = 'Checking...';
  return;
}

function stopLoading() {
  checkVeganButton.disabled = false;
  checkVeganButton.innerText = 'Check Vegan';
  return;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_RECIPE_DATA') {
    updateRecipeDisplay(message.recipeData);
  }
});

refreshButton.addEventListener('click', async () => {
  initializeSidePanel();
});

checkVeganButton.addEventListener('click', async () => {
  console.log('Check Vegan button clicked');
  // Get the current recipe data displayed
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];
  const ingredients = recipeData ? recipeData.ingredients : [];
  console.log('Current ingredients:', ingredients);
  startLoading();
  try {
    const fullPrompt = `${systemPrompt}\n\nIngredients:\n${ingredients.join('\n')}\n\nIs this recipe vegan? Respond with 'True' or 'False'.`;
    const params = {
      initialPrompts: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.1,
      topK: 1,
      outputLanguage: 'en',
    };
    const result = await runPrompt(fullPrompt, params);
    const isVegan = parseLLMBoolean(result);
    // update vegan tag
    if (isVegan) {
      veganTagElement.innerText = "✓Vegan";
    } else if (!isVegan) {
      veganTagElement.innerText = "✗Not Vegan";
      handleNonVeganRecipe(ingredients);
    }
    stopLoading();
    console.log('Vegan check result:', result);

  } catch (error) {
    stopLoading();
    console.log('Error checking vegan status:', error);
  }
});

async function handleNonVeganRecipe(ingredients) {
  // First step, check if we can make it vegan
  const fullPrompt = `${classifyPrompt}\n\nIngredients:\n${ingredients.join('\n')}\n\nCan this recipe be made vegan? Respond with 'True' or 'False'.`;
  const params = {
    initialPrompts: [
      { role: 'system', content: classifyPrompt }
    ],
    temperature: 0.1,
    topK: 1,
    outputLanguage: 'en',
  };
  const result = await runPrompt(fullPrompt, params);
  const canMakeVegan = parseLLMBoolean(result);
  if (canMakeVegan) {
    // Show "Make it Vegan" button
    makeVeganButton.hidden = false;
    makeVeganButton.onclick = async () => {
      handleMakeVegan(ingredients);
    };
  }
}

async function handleMakeVegan(ingredients) {
  function parseVeganizedIngredients(aiResponse) {
    try {
      // Remove potential markdown code fences
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }

      // Parse JSON
      const parsed = JSON.parse(cleanResponse.trim());

      // Validate structure
      if (parsed.vegan_recipe && Array.isArray(parsed.vegan_recipe)) {
        return parsed.vegan_recipe;
      } else {
        console.error("Response missing 'vegan_recipe' array");
        return [];
      }

    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Raw response:", aiResponse);
      return [];
    }
  }
  const convertFullPrompt = `${convertPrompt}\n\nIngredients:\n${ingredients.join('\n')}\n\nProvide the substitutions in JSON format.`;
  const convertParams = {
    initialPrompts: [
      { role: 'system', content: convertPrompt }
    ],
    temperature: 0.1,
    topK: 1,
    outputLanguage: 'en',
  };
  try {
    // Get vegan substitutions from LLM
    const convertResult = await runPrompt(convertFullPrompt, convertParams);
    console.log('Vegan conversion result:', convertResult);
    // Parse the result into a list
    const newIngredients = parseVeganizedIngredients(convertResult);
    // Display updated ingredients
    recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
    newIngredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.innerHTML = ingredient; // Use innerHTML to allow <del> tags
      recipeIngredientsElement.appendChild(li);
    });
    // Update vegan tag
    veganTagElement.innerText = "✓Vegan (with substitutions)";
    // Hide the make vegan button
    makeVeganButton.hidden = true;

  } catch (error) {
    console.log('Error getting vegan substitutions:', error);
  }
}

async function initializeSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];

  if (recipeData) {
    updateRecipeDisplay(recipeData);
  } else {
    // If no data is found, request it from the content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'GET_RECIPE_DATA',
      });
      updateRecipeDisplay(response);
    } catch (error) {
      console.log('Error initializing side panel:', error);
    }
  }
}

initializeSidePanel();

function parseLLMBoolean(response) {
  // Handle null/undefined/empty
  if (response == null || response === '') {
    return null;
  }

  // Convert to string and normalize
  const normalized = String(response)
    .trim()
    .toLowerCase();

  // Handle empty strings after trim
  if (normalized === '') {
    return null;
  }

  // Check for explicit true/false at the start
  if (normalized.startsWith('true')) {
    return true;
  }
  if (normalized.startsWith('false')) {
    return false;
  }

  // Check for yes/no patterns
  if (/^(yes|y)\b/i.test(normalized)) {
    return true;
  }
  if (/^(no|n)\b/i.test(normalized)) {
    return false;
  }

  // Check for affirmative/negative keywords at the start
  const affirmativeWords = ['correct', 'affirmative', 'confirmed', 'indeed', 'absolutely'];
  const negativeWords = ['incorrect', 'negative', 'denied', 'nope'];

  for (const word of affirmativeWords) {
    if (normalized.startsWith(word)) {
      return true;
    }
  }

  for (const word of negativeWords) {
    if (normalized.startsWith(word)) {
      return false;
    }
  }

  // Can't determine - return null
  return null;
}