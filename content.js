function getRecipeTitle(article) {
    console.log("Getting recipe title...");
    let titleElement = article?.querySelector('h1'); // Add optional chaining
    if (titleElement) {
        console.log("Recipe title found: " + titleElement.innerText.trim());
        return titleElement.innerText.trim();
    } else {
        console.warn("Recipe title not found.");
        return "Title Not Found";
    }
}

// Send the recipe title to the side panel
chrome.runtime.sendMessage({
    type: "RECIPE_INFO",
    title: getRecipeTitle(document.querySelector('article'))
}, (response) => {
    console.log("Response from side panel:", response);
});

console.log("content.js loaded and executed.");