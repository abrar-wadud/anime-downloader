document.addEventListener('DOMContentLoaded', () => {
    // Initialize page state
    document.getElementById('episodeList').classList.add('hidden');
    document.getElementById('searchResults').classList.add('hidden');
});

document.getElementById('animeForm').addEventListener('submit', event => {
    event.preventDefault();
    handleFetchDownloadLinks();
});

let debounceTimeout;
document.getElementById('animeSearch').addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const query = document.getElementById('animeSearch').value.trim();
        if (query.length > 0) {
            searchAnime(query);
            document.getElementById('searchResults').classList.remove('hidden');
        } else {
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchResults').classList.add('hidden');
        }
    }, 500); // 500ms delay
});

let selectedAnimeUrl = ''; // Internal variable to store selected anime URL
let selectedAnimeTitle = ''; // Internal variable to store selected anime title with year

async function searchAnime(query) {
    const searchUrl = `https://anitaku.pe/search.html?keyword=${encodeURIComponent(query)}`;
    const searchResultsContainer = document.getElementById('searchResults');

    // Show loading animation
    searchResultsContainer.innerHTML = '<div id="loading" class="loading"><div class="bouncing-dots"><div></div><div></div><div></div></div><p>Loading...</p></div>';
    searchResultsContainer.classList.remove('hidden');

    try {
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error(`Failed to retrieve search results. Status code: ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.items li');

        searchResultsContainer.innerHTML = ''; // Clear previous results

        if (items.length === 0) {
            // Display a message if no results are found
            searchResultsContainer.innerHTML = '<p>No results found.</p>';
        } else {
            items.forEach(item => {
                const titleElement = item.querySelector('.name a');
                const title = titleElement.textContent.trim();
                const url = titleElement.getAttribute('href');
                const imgSrc = item.querySelector('.img img').getAttribute('src');
                const releasedYear = item.querySelector('.released').textContent.trim();

                const resultItem = document.createElement('div');
                resultItem.classList.add('result-item');
                resultItem.innerHTML = `
                    <div class="result-img">
                        <img src="${imgSrc}" alt="${title}">
                    </div>
                    <div class="result-info">
                        <h3>${title}</h3>
                        <p>${releasedYear}</p>
                        <button type="button" data-url="${url}">Select</button>
                    </div>
                `;

                resultItem.querySelector('button').addEventListener('click', function() {
                    selectedAnimeUrl = `https://anitaku.pe${url}`; // Save selected URL
                    document.getElementById('animeSearch').value = `${title} (${releasedYear})`; // Update input field
                    searchResultsContainer.innerHTML = ''; // Clear search results after selection
                    searchResultsContainer.classList.add('hidden'); // Hide search results
                });

                searchResultsContainer.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        searchResultsContainer.innerHTML = '<p>An error occurred while searching. Please try again later.</p>';
    } finally {
        // Hide loading animation
        searchResultsContainer.classList.remove('hidden');
    }
}

async function handleFetchDownloadLinks() {
    const startEpisode = parseInt(document.getElementById('startEpisode').value);
    const endEpisode = parseInt(document.getElementById('endEpisode').value);

    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = ''; // Clear previous errors

    if (!selectedAnimeUrl) {
        showError('Please select an anime from the search results.');
        return;
    }

    if (isNaN(startEpisode) || startEpisode < 1) {
        showError('Please enter a valid start episode number.');
        return;
    }

    if (isNaN(endEpisode) || endEpisode < 1) {
        showError('Please enter a valid end episode number.');
        return;
    }

    if (startEpisode > endEpisode) {
        showError('Start episode number must be less than or equal to end episode number.');
        return;
    }

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('episodeList').innerHTML = '';

    try {
        const episodeOptions = await fetchDownloadLinks(selectedAnimeUrl, startEpisode, endEpisode);
        displayEpisodeList(episodeOptions);
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while fetching episode links. Please try again later.');
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorItem = document.createElement('div');
    errorItem.classList.add('error-item');
    errorItem.textContent = message;
    errorContainer.appendChild(errorItem);
}

async function fetchDownloadLinks(animeUrl, startEpisode, endEpisode) {
    const episodeOptions = [];
    const concurrentRequests = 5;
    const queue = [];

    for (let episodeNumber = startEpisode; episodeNumber <= endEpisode; episodeNumber++) {
        const episodeUrl = changeUrlFormat(animeUrl, episodeNumber);
        const episodeTitle = `Episode ${episodeNumber}`;
        queue.push(scrapeEpisodePage(episodeUrl, episodeTitle));

        if (queue.length >= concurrentRequests || episodeNumber === endEpisode) {
            const results = await Promise.all(queue);
            episodeOptions.push(...results.filter(link => link));
            queue.length = 0;
        }
    }

    return episodeOptions;
}

async function scrapeEpisodePage(url, episodeTitle) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to retrieve the webpage. Status code: ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const downloadLink = doc.querySelector('.favorites_book a[href^="http"]')?.getAttribute('href');

        return { title: episodeTitle, downloadLink: downloadLink || null };
    } catch (error) {
        console.error('Error occurred during request:', error);
        return null;
    }
}

function displayEpisodeList(episodeOptions) {
    const episodeListContainer = document.getElementById('episodeList');
    episodeListContainer.innerHTML = ''; // Clear previous content

    const fragment = document.createDocumentFragment();
    episodeOptions.forEach(episode => {
        const episodeItem = document.createElement('div');
        episodeItem.classList.add('episode-item');
        episodeItem.innerHTML = `<a href="${episode.downloadLink}" target="_blank">${episode.title}</a>`;
        fragment.appendChild(episodeItem);
        episodeItem.addEventListener('click', function() {
            episodeItem.classList.add('clicked');
        });
    });
    episodeListContainer.appendChild(fragment);
    episodeListContainer.classList.remove('hidden');
}


function changeUrlFormat(animeUrl, episodeNumber) {
    const base_url = animeUrl.split('category/')[0];
    const anime_title = animeUrl.split('/').pop();
    return `${base_url}${anime_title}-episode-${episodeNumber}`;
}
