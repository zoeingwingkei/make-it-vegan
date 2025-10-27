
const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');
const recipeDataElement = document.body.querySelector('#recipe-container');
const noRecipeFoundElement = document.body.querySelector('#no-recipe-found');
const recipeIngredientsElement = document.body.querySelector('#recipe-ingredients');
const recipeStepsElement = document.body.querySelector('#recipe-steps');
const veganTagElement = document.body.querySelector('#vegan-tag');

const checkVeganButton = document.body.querySelector('#button-check-vegan');

const systemPrompt = "You are a helpful assistant that determines whether a recipe is vegan based on its ingredients. A vegan recipe contains no animal products, including meat, dairy, eggs, honey, or any other animal-derived ingredients. When given a list of ingredients, respond with 'True' if all ingredients are vegan, or 'False' if any animal products are present.";

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
    checkVeganButton.hidden = true;
    return;
  }

  // Show the recipe data elements
  recipeDataElement.hidden = false;
  noRecipeFoundElement.hidden = true;
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  recipeStepsElement.innerHTML = ''; // Clear previous steps
  veganTagElement.innerText = ''; // Clear previous tag state
  checkVeganButton.hidden = false;
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

function showLoading() {
  // WIP
  console.log('Loading...');
  return;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_RECIPE_DATA') {
    updateRecipeDisplay(message.recipeData);
  }
});

checkVeganButton.addEventListener('click', async () => {
  console.log('Check Vegan button clicked');
  // Get the current recipe data displayed
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];
  const ingredients = recipeData ? recipeData.ingredients : [];
  console.log('Current ingredients:', ingredients);
  showLoading();
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
    // update vegan tag
    veganTagElement.innerText = `Vegan: ${result.trim()}`;
    console.log('Vegan check result:', result);

  } catch (error) {
    console.log('Error checking vegan status:', error);
  }
});

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