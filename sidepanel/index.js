
const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');
const recipeDataElement = document.body.querySelector('#recipe-container');
const noRecipeFoundElement = document.body.querySelector('#no-recipe-found');
const recipeIngredientsElement = document.body.querySelector('#recipe-ingredients');
const recipeStepsElement = document.body.querySelector('#recipe-steps');
const veganTagElement = document.body.querySelector('#vegan-tag');
const recipeTotalTimeElement = document.body.querySelector('#recipe-total-time');
const recipeServingsElement = document.body.querySelector('#recipe-servings');
const recipePrepTimeElement = document.body.querySelector('#recipe-prep-time');
const recipeCookTimeElement = document.body.querySelector('#recipe-cook-time');

const loadingIndicator = document.body.querySelector('#loading-indicator');

const makeVeganButton = document.body.querySelector('#button-make-vegan');
const refreshButton = document.body.querySelector('#button-fresh');
const scanButton = document.body.querySelector('#button-scan');
const autoScanCheckbox = document.body.querySelector('#checkbox-auto-scan');
const autoScanLabel = document.body.querySelector('#label-auto-scan');

import {checkVeganPrompt, classifyPrompt, convertPrompt, convertStepsPrompt} from './modules/prompts.js';
import {parseLLMBoolean, parseLLMJSON, extractSubstitutions} from './modules/parsing.js';
import {runPrompt} from './modules/llm.js';

let session;

async function getRecipeData(){
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];
  return recipeData;
}

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
    return;
  }

  // Show the recipe data elements
  recipeDataElement.hidden = false;
  noRecipeFoundElement.hidden = true;
  refreshButton.hidden = true;
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
  recipeTotalTimeElement.innerText = recipeData.metadata.totalTime || "N/A";
  recipeServingsElement.innerText = recipeData.metadata.servings || "N/A";
  recipePrepTimeElement.innerText = recipeData.metadata.prepTime || "N/A";
  recipeCookTimeElement.innerText = recipeData.metadata.cookTime || "N/A";
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  recipeStepsElement.innerHTML = ''; // Clear previous steps
  veganTagElement.innerText = ''; // Clear previous tag state
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

  // If this is a valid recipe, and autoscan is enabled, check vegan
  const autoScanEnabled = await chrome.storage.sync.get('autoScan');
  if (autoScanEnabled.autoScan) {
    checkVegan(recipeData);
  }

}

function startLoading() {
  loadingIndicator.hidden = false;
  return;
}

function stopLoading() {
  loadingIndicator.hidden = true;
  return;
}

function updateAutoScanUI(isEnabled) {
  if (isEnabled) {  
    autoScanLabel.innerText = "Auto Scan (On)";
    scanButton.hidden = true;
  } else {
    autoScanLabel.innerText = "Auto Scan (Off)";
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

async function checkVegan(recipe) {
  startLoading();
  try {
    const ingredients = recipe.ingredients;
    const recipeName = recipe.title;
    const userPrompt = `Name:${recipeName}\nIngredients:\n${ingredients.join('\n')}\n\nIs this recipe vegan? Respond with 'True' or 'False'.`;
    const result = await runPrompt(userPrompt, checkVeganPrompt, session);
    const isVegan = parseLLMBoolean(result);
    // update vegan tag
    if (isVegan) {
      veganTagElement.innerText = "✓Vegan";
    } else if (!isVegan) {
      veganTagElement.innerText = "✗Not Vegan";
      await handleNonVeganRecipe(recipe);
    }
    stopLoading();

  } catch (error) {
    stopLoading();
    console.log('Error checking vegan status:', error);
  }
}

async function handleNonVeganRecipe(recipe) {
  const ingredients = recipe.ingredients;
  // First step, check if we can make it vegan
  const userPrompt = `Ingredients:\n${ingredients.join('\n')}\n\nCan this recipe be made vegan? Respond with 'True' or 'False'.`;
  const result = await runPrompt(userPrompt, classifyPrompt, session);
  const canMakeVegan = parseLLMBoolean(result);
  if (canMakeVegan) {
    // Show "Make it Vegan" button
    makeVeganButton.hidden = false;
    makeVeganButton.onclick = async () => {
      handleMakeVegan(recipe);
    };
  }
}

async function handleMakeVegan(recipe) {
  try {
    startLoading();

    // Get vegan substitutions from LLM
    const ingredients = recipe.ingredients;
    const ingredientsPrompt = `Ingredients:\n${ingredients.join('\n')}\n\nProvide the substitutions in JSON format.`;
    const convertResult = await runPrompt(ingredientsPrompt, convertPrompt, session);
    
    // Parse the result into a list
    const newIngredients = parseLLMJSON(convertResult);

    // Display updated ingredients
    recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
    newIngredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.innerHTML = ingredient; // Use innerHTML to allow <del> tags
      recipeIngredientsElement.appendChild(li);
    });

    // Get updated steps
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

    stopLoading();


    // Update vegan tag
    veganTagElement.innerText = "✓Vegan (with substitutions)";
    // Hide the make vegan button
    makeVeganButton.hidden = true;

  } catch (error) {
    console.log('Error getting vegan substitutions:', error);
  }
}

async function initializeSidePanel() {
  const recipeData = await getRecipeData();
  // Get the saved auto scan preference
  const autoScanEnabled = await chrome.storage.sync.get('autoScan');
  if ( autoScanEnabled.autoScan === undefined ) {
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
