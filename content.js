

function getRecipeTitle(article) {
    console.log("Getting recipe title...");
    let recipeTitle = findRecipeTitle(article);
    if (recipeTitle) {
        console.log("Recipe title found: " + recipeTitle);
        return recipeTitle;
    } else {
        return "Title Not Found";
    }
}

function getRecipeImage(article) {
    let coverImage = findCoverImage(article);
    if (coverImage) {
        return coverImage;
    } else {
        return "Image Not Found";
    }
}

function getRecipeIngredients(article) {
    let ingredients = findRecipeIngredients(article);
    if (ingredients && ingredients.length > 0) {
        console.log("Ingredients found: ", ingredients);
        return ingredients;
    } else {
        console.log("No ingredients found.");
        return ["Ingredients Not Found"];
    }
}

function getRecipeSteps(article) {
    let steps = findRecipeSteps(article);
    if (steps && steps.length > 0) {
        console.log("Steps found: ", steps);
        return steps;
    } else {
        console.log("No steps found.");
        return ["Steps Not Found"];
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_RECIPE_DATA') {
        const bodyElement = document.querySelector('body');
        const articleElement = document.querySelector('article');
        const recipeTitle = getRecipeTitle(bodyElement);
        const recipeImage = getRecipeImage(articleElement);
        const recipeMetadata = findRecipeMetadata(bodyElement);
        const recipeIngredients = getRecipeIngredients(articleElement);
        const recipeSteps = getRecipeSteps(articleElement);
        const recipeData = {
            title: recipeTitle,
            image: recipeImage,
            metadata: recipeMetadata,
            ingredients: recipeIngredients,
            steps: recipeSteps,
        };
        sendResponse(recipeData);
    }
    return true; // Keep the message channel open for async response
});
