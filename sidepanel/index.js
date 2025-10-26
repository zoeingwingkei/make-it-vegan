
const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');
const recipeDataElement = document.body.querySelector('#recipe-container');
const noRecipeFoundElement = document.body.querySelector('#no-recipe-found');
const recipeIngredientsElement = document.body.querySelector('#recipe-ingredients');
const recipeStepsElement = document.body.querySelector('#recipe-steps');


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
    return;
  }

  // Show the recipe data elements
  recipeDataElement.hidden = false;
  noRecipeFoundElement.hidden = true;
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
  recipeIngredientsElement.innerHTML = ''; // Clear previous ingredients
  recipeStepsElement.innerHTML = ''; // Clear previous steps
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_RECIPE_DATA') {
    updateRecipeDisplay(message.recipeData);
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