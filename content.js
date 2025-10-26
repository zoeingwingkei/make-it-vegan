

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_RECIPE_DATA') {
        const recipeData = {
            title: getRecipeTitle(document.querySelector('article')),
            image: getRecipeImage(document.querySelector('article'))
        };
        sendResponse(recipeData);
    }
    return true; // Keep the message channel open for async response
});