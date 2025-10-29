
const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');
const recipeDataElement = document.body.querySelector('#recipe-container');
const noRecipeFoundElement = document.body.querySelector('#no-recipe-found');
const recipeIngredientsElement = document.body.querySelector('#recipe-ingredients');
const recipeStepsElement = document.body.querySelector('#recipe-steps');
const veganTagElement = document.body.querySelector('#vegan-tag');
const veganTagContainerElement = document.body.querySelector('#vegan-tag-container');
const recipeTotalTimeElement = document.body.querySelector('#recipe-total-time');
const recipeServingsElement = document.body.querySelector('#recipe-servings');
const recipePrepTimeElement = document.body.querySelector('#recipe-prep-time');
const recipeCookTimeElement = document.body.querySelector('#recipe-cook-time');

const makeVeganButton = document.body.querySelector('#button-make-vegan');
const neverMindButton = document.body.querySelector('#button-never-mind');
const refreshButton = document.body.querySelector('#button-fresh');
const scanButton = document.body.querySelector('#button-scan');
const autoScanCheckbox = document.body.querySelector('#checkbox-auto-scan');
const autoScanLabel = document.body.querySelector('#label-auto-scan');

const veganTagLoader = document.body.querySelector('#vegan-tag-loader');
const pageLoaderContainerElement = document.body.querySelector('#page-loader-container');
const pageContentElement = document.body.querySelector('#page-content');
const errorMessageElement = document.body.querySelector('#error-message');

const messageBoxContainerElement = document.body.querySelector('#message-box-container');
const messageBoxLoader = document.body.querySelector('#message-box-loader');
const messageTitleElement = document.body.querySelector('#message-title');
const messageBodyElement = document.body.querySelector('#message-body');
const actionPanelElement = document.body.querySelector('#action-panel');
const closeButtonElement = document.body.querySelector('#button-close');

const loadingTime = 250;

import { checkVeganPrompt, classifyPrompt, convertPrompt, convertStepsPrompt } from './modules/prompts.js';
import { parseLLMBoolean, parseLLMJSON, extractSubstitutions } from './modules/parsing.js';
import { runPrompt } from './modules/llm.js';

let session;

async function getRecipeData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];
  return recipeData;
}

function fillIngredientList(ingredients) {
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  ingredients.forEach((ingredient, index) => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ingredient-checkbox';
    checkbox.id = `ingredient-${index}`;

    const label = document.createElement('label');
    label.htmlFor = `ingredient-${index}`;
    label.innerHTML = ingredient;

    li.appendChild(checkbox);
    li.appendChild(label);

    recipeIngredientsElement.appendChild(li);
  });
}

async function updateRecipeDisplay(recipeData) {
  startLoadingPage();

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
    errorMessageElement.hidden = false;
    scanButton.hidden = true;
    setTimeout(() => {
      stopLoadingPage();
    }, loadingTime);
    return;
  }

  // Show the recipe data elements
  recipeDataElement.hidden = false;
  errorMessageElement.hidden = true;
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
  recipeTotalTimeElement.innerText = recipeData.metadata.totalTime || "N/A";
  recipeServingsElement.innerText = recipeData.metadata.servings || "N/A";
  recipePrepTimeElement.innerText = recipeData.metadata.prepTime || "N/A";
  recipeCookTimeElement.innerText = recipeData.metadata.cookTime || "N/A";
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  recipeStepsElement.innerHTML = ''; // Clear previous steps
  veganTagElement.innerText = ''; // Clear previous tag state
  veganTagContainerElement.hidden = true;
  handleMessageBox(false, true, false); // Clear message box
  fillIngredientList(recipeData.ingredients);
  recipeData.steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    recipeStepsElement.appendChild(li);
  });

  setTimeout(() => {
    stopLoadingPage();
  }, loadingTime);

  // If this is a valid recipe, and autoscan is enabled, check vegan
  const autoScanEnabled = await chrome.storage.sync.get('autoScan');
  if (!autoScanEnabled.autoScan) {
    scanButton.hidden = false;
  }
  if (autoScanEnabled.autoScan) {
    checkVegan(recipeData);
  }

}

function updateAutoScanUI(isEnabled) {
  if (isEnabled) {
    autoScanLabel.innerText = "Auto Check: On";
    scanButton.hidden = true;
  } else {
    autoScanLabel.innerText = "Auto Check: Off";
    scanButton.hidden = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_RECIPE_DATA') {
    updateRecipeDisplay(message.recipeData);
  }
});

autoScanCheckbox.addEventListener('change', async () => {
  const isChecked = autoScanCheckbox.checked;
  chrome.storage.sync.set({ autoScan: isChecked });
  updateAutoScanUI(isChecked);
  const recipeData = await getRecipeData();
  if (isChecked && recipeData) {
    checkVegan(recipeData);
  }
});

refreshButton.addEventListener('click', async () => {
  initializeSidePanel();
});

scanButton.addEventListener('click', async () => {
  const recipeData = await getRecipeData();
  if (recipeData) {
    checkVegan(recipeData);
  }
});

neverMindButton.addEventListener('click', ()=>{
  handleMessageBox(false, true, false);
});

closeButtonElement.addEventListener('click', ()=>{
  handleMessageBox(false, true, false);
});

async function checkVegan(recipe) {
  startLoadingScan();
  try {
    const ingredients = recipe.ingredients;
    const recipeName = recipe.title;
    const userPrompt = `Name:${recipeName}\nIngredients:\n${ingredients.join('\n')}\n\nIs this recipe vegan? Respond with 'True' or 'False'.`;
    const result = await runPrompt(userPrompt, checkVeganPrompt, session);
    const isVegan = parseLLMBoolean(result);
    // update vegan tag
    if (isVegan) {
      stopLoadingScan();
      veganTagElement.innerText = "Vegan";
      veganTagContainerElement.classList.add('vegan');
      handleMessageBox(false, true, false);
    } else if (!isVegan) {
      stopLoadingScan();
      veganTagElement.innerText = "Not Vegan";
      veganTagContainerElement.classList.add('non-vegan');
      await handleNonVeganRecipe(recipe);
    }

  } catch (error) {
    console.log('Error checking vegan status:', error);
  }
}

async function handleNonVeganRecipe(recipe) {
  handleMessageBox(true, false, false);
  const ingredients = recipe.ingredients;
  // First step, check if we can make it vegan
  const userPrompt = `Ingredients:\n${ingredients.join('\n')}\n\nCan this recipe be made vegan? Respond with 'True' or 'False'.`;
  const result = await runPrompt(userPrompt, classifyPrompt, session);
  const canMakeVegan = parseLLMBoolean(result);
  if (canMakeVegan) {
    handleMessageBox(false, false, true);
    makeVeganButton.onclick = async () => {
      handleMakeVegan(recipe);
    };
  } else {
    handleMessageBox(false, false, false);
  }
}

async function handleMakeVegan(recipe) {
  try {
    
    // Get vegan substitutions from LLM
    handleMakeVeganLoading(true, false, false);
    const ingredients = recipe.ingredients;
    const ingredientsPrompt = `Ingredients:\n${ingredients.join('\n')}\n\nProvide the substitutions in JSON format.`;
    const convertResult = await runPrompt(ingredientsPrompt, convertPrompt, session);

    // Parse the result into a list
    const newIngredients = parseLLMJSON(convertResult);

    // Display updated ingredients
    fillIngredientList(newIngredients);

    // Get updated steps
    handleMakeVeganLoading(false, true, false);
    const steps = recipe.steps;
    const extractedSubs = extractSubstitutions(newIngredients);
    console.log('Extracted Substitutions:', extractedSubs);
    const stepsPrompt = `Ingredient substitutions list:\n${extractedSubs.join('\n')}\n\nOriginal Steps:\n${steps.join('\n')}\n\nProvide the updated steps in JSON format.`;
    const stepsResult = await runPrompt(stepsPrompt, convertStepsPrompt, session);
    const newSteps = parseLLMJSON(stepsResult);

    // Display updated steps
    recipeStepsElement.innerHTML = ''; // Clear previous steps
    newSteps.forEach(step => {
      const li = document.createElement('li');
      li.innerHTML = step;
      recipeStepsElement.appendChild(li);
    });


    // Update vegan tag
    veganTagElement.innerText = "Vegan (with substitutions)";
    veganTagContainerElement.classList.remove('non-vegan');
    veganTagContainerElement.classList.add('vegan');
    handleMakeVeganLoading(false, false, true);

  } catch (error) {
    console.log('Error getting vegan substitutions:', error);
  }
}

async function initializeSidePanel() {

  const recipeData = await getRecipeData();
  // Get the saved auto scan preference
  const autoScanEnabled = await chrome.storage.sync.get('autoScan');
  if (autoScanEnabled.autoScan === undefined) {
    // Default to false if not set
    await chrome.storage.sync.set({ autoScan: false });
  }
  autoScanCheckbox.checked = autoScanEnabled.autoScan || false;
  updateAutoScanUI(autoScanEnabled.autoScan || false);

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

// Loading functions
function startLoadingScan() {
  veganTagContainerElement.classList.add('loading');
  veganTagContainerElement.classList.remove('vegan', 'non-vegan');
  veganTagContainerElement.hidden = false;
  veganTagLoader.hidden = false;
  veganTagElement.innerText = 'Checking...';
  return;
}

function stopLoadingScan() {
  veganTagContainerElement.classList.remove('loading');
  veganTagLoader.hidden = true;
  return;
}

// WIP: the page load function has not applied into the page yet... need to figure out how (maybe need to set something in the background.js file)

function startLoadingPage() {
  pageContentElement.hidden = true;
  pageLoaderContainerElement.hidden = false;
}

function stopLoadingPage() {
  pageContentElement.hidden = false;
  pageLoaderContainerElement.hidden = true;
}

function handleMessageBox(isLoading, hide, canMakeVegan) {
  messageBoxContainerElement.classList.remove('can-make-vegan');
  if (hide) {
    messageBoxContainerElement.hidden = true;
    return
  }
  messageBoxContainerElement.hidden = false;
  if (isLoading) {
    messageBoxLoader.hidden = false;
    messageTitleElement.innerText = 'Looking for vegan options...';
    messageBodyElement.innerText = '';
    actionPanelElement.hidden = true;
    return
  }
  if (canMakeVegan) {
    messageBoxContainerElement.classList.add('can-make-vegan');
    messageBoxLoader.hidden = true;
    messageTitleElement.innerText = 'We can make this non vegan recipe vegan!';
    messageBodyElement.innerText = '';
    actionPanelElement.hidden = false;
    return
  }
  if (!canMakeVegan) {
    messageBoxLoader.hidden = true;
    messageTitleElement.innerText = 'This recipe is not vegan.';
    messageBodyElement.innerText = 'And it is unlikely to make it vegan.';
    actionPanelElement.hidden = true;
  }
}

function handleMakeVeganLoading(isLoadingIngredients, isLoadingSteps, finishLoading) {
  actionPanelElement.hidden = true;
  if (isLoadingIngredients) {
    messageBoxLoader.hidden = false;
    messageTitleElement.innerText = 'Make it vegan';
    messageBodyElement.innerText = 'Modifying ingredients...';
    return;
  }
  if (isLoadingSteps) {
    messageBoxLoader.hidden = false;
    messageTitleElement.innerText = 'Make it vegan';
    messageBodyElement.innerText = 'Modifying steps...';
    return;
  }
  if (finishLoading) {
    messageBoxLoader.hidden = false;
    messageTitleElement.innerText = 'Make it vegan';
    messageBodyElement.innerText = 'Done!';
    setTimeout(() => {
        messageBoxContainerElement.hidden = true;
    }, 500);
    return;
  }
}