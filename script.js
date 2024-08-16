document.addEventListener('DOMContentLoaded', function() {
    // Initialize page state
    document.getElementById('episodeList').classList.add('hidden');
    document.getElementById('searchResults').classList.add('hidden');
});

document.getElementById('animeForm').addEventListener('submit', function(event) {
    event.preventDefault();
    handleFetchDownloadLinks();
});

document.getElementById('animeSearch').addEventListener('input', function() {
    const query = this.value.trim();
    const searchResultsContainer = document.getElementById('searchResults');

    if (query.length > 2) {
        searchAnime(query);
        searchResultsContainer.classList.remove('hidden');
    } else {
        searchResultsContainer.innerHTML = ''; // Clear search results if query is too short
        searchResultsContainer.classList.add('hidden');
    }
});

let selectedAnimeUrl = ''; // Internal variable to store selected anime URL

async function searchAnime(query) {
    const searchUrl = `https://anitaku.pe/search.html?keyword=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error('Failed to retrieve search results. Status code: ' + response.status);
        }
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.items li');
        
        const searchResultsContainer = document.getElementById('searchResults');
        searchResultsContainer.innerHTML = ''; // Clear previous results

        items.forEach(item => {
            const titleElement = item.querySelector('.name a');
            const title = titleElement.getAttribute('title');
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
                searchResultsContainer.innerHTML = ''; // Clear search results after selection
                searchResultsContainer.classList.add('hidden'); // Hide search results
            });

            searchResultsContainer.appendChild(resultItem);
        });
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while searching. Please try again later.');
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

    document.getElementById('loading').style.display = 'block';
    document.getElementById('episodeList').innerHTML = '';

    try {
        const episodeOptions = await fetchDownloadLinks(selectedAnimeUrl, startEpisode, endEpisode);
        displayEpisodeList(episodeOptions);
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while fetching episode links. Please try again later.');
    } finally {
        document.getElementById('loading').style.display = 'none';
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
    const promises = [];

    for (let episodeNumber = startEpisode; episodeNumber <= endEpisode; episodeNumber++) {
        const episodeUrl = changeUrlFormat(animeUrl, episodeNumber);
        const episodeTitle = `Episode ${episodeNumber}`;
        promises.push(scrapeEpisodePage(episodeUrl, episodeTitle));

        if (promises.length >= concurrentRequests || episodeNumber === endEpisode) {
            const results = await Promise.all(promises);
            episodeOptions.push(...results.filter(link => link));
            promises.length = 0;
        }
    }

    return episodeOptions;
}

async function scrapeEpisodePage(url, episodeTitle) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to retrieve the webpage. Status code: ' + response.status);
        }
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
    episodeListContainer.innerHTML = '';

    episodeOptions.forEach(episode => {
        const episodeItem = document.createElement('div');
        episodeItem.classList.add('episode-item');
        episodeItem.innerHTML = `<a href="${episode.downloadLink}" target="_blank">${episode.title}</a>`;
        episodeListContainer.appendChild(episodeItem);

        // Add click event listener to the episode item
        episodeItem.addEventListener('click', function() {
            this.classList.add('clicked');
        });
    });

    episodeListContainer.classList.remove('hidden'); // Ensure episode list is visible
}

function changeUrlFormat(animeUrl, episodeNumber) {
    const base_url = animeUrl.split('category/')[0];
    const anime_title = animeUrl.split('/').pop();
    const episodeUrl = base_url + anime_title + '-episode-' + episodeNumber;
    return episodeUrl;
}
