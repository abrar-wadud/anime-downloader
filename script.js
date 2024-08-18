document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('episodeList').classList.add('hidden');
    document.getElementById('searchResults').classList.add('hidden');
});

document.getElementById('animeForm').addEventListener('submit', event => {
    event.preventDefault();
    handleFetchDownloadLinks();
});

// Function to clear the selected anime display
function clearSelectedAnime() {
    const selectedAnime = document.getElementById('selectedAnime');
    selectedAnime.classList.add('hidden');
}

let debounceTimeout;
// Event listener for the search input
document.getElementById('animeSearch').addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const query = document.getElementById('animeSearch').value.trim();
        if (query.length > 0) {
            clearSelectedAnime(); // Clear previous selection when a new search starts
            searchAnime(query);
            document.getElementById('searchResults').classList.remove('hidden');
        } else {
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchResults').classList.add('hidden');
            clearSelectedAnime(); // Clear selection when search query is empty
        }
    }, 500); // 500ms delay
});

function showSelectedAnime(title, year, imgSrc, episodeCount) {
    const selectedAnimeTitle = document.getElementById('selectedAnimeTitle');
    const selectedAnimeYear = document.getElementById('selectedAnimeYear');
    const selectedAnimeImage = document.getElementById('selectedAnimeImage');
    const selectedAnime = document.getElementById('selectedAnime');
    const selectedepisodeCount = document.getElementById('selectedepisodeCount')
    
    selectedAnimeTitle.textContent = title;
    selectedepisodeCount.textContent = `${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}`;
    selectedAnimeYear.textContent = `${year}`;
    selectedAnimeImage.src = imgSrc;
    selectedAnime.classList.remove('hidden');
}

let selectedAnimeUrl = '';

// Function to handle search and update search results
async function searchAnime(query) {
    const searchUrl = `https://anitaku.pe/search.html?keyword=${encodeURIComponent(query)}`;
    const searchResultsContainer = document.getElementById('searchResults');

    searchResultsContainer.innerHTML = `
        <div class="loading">
            <div class="bouncing-dots">
                <div></div>
                <div></div>
                <div></div>
            </div>
            <p>Loading...</p>
        </div>
    `;
    searchResultsContainer.classList.remove('hidden');

    try {
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error(`Failed to retrieve search results. Status code: ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.items li');

        searchResultsContainer.innerHTML = '';

        if (items.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results found.</p>';
        } else {
            items.forEach(async item => {
                const titleElement = item.querySelector('.name a');
                const title = titleElement.textContent.trim();
                const url = titleElement.getAttribute('href');
                const imgSrc = item.querySelector('.img img').getAttribute('src');
                const releasedYear = item.querySelector('.released').textContent.trim();

                // Fetch additional information about episodes
                const episodeCount = await fetchEpisodeCount(`https://anitaku.pe${url}`);

                const resultItem = document.createElement('div');
                resultItem.classList.add('result-item');
                resultItem.dataset.url = `https://anitaku.pe${url}`;
                resultItem.dataset.title = title;
                resultItem.dataset.year = releasedYear;
                resultItem.dataset.imgSrc = imgSrc;
                resultItem.dataset.episodeCount = episodeCount; // Store episode count
                resultItem.innerHTML = `
                    <div class="result-img">
                        <img src="${imgSrc}" alt="${title}">
                    </div>
                    <div class="result-info">
                        <h3>${title}</h3>
                        <p>${releasedYear}</p>
                        <p>${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}</p>
                    </div>
                `;

                resultItem.addEventListener('click', function() {
                    const { title, year, imgSrc, episodeCount } = this.dataset;
                    showSelectedAnime(title, year, imgSrc, episodeCount);
                    selectedAnimeUrl = this.dataset.url;
                    searchResultsContainer.innerHTML = '';
                    searchResultsContainer.classList.add('hidden');
                });

                searchResultsContainer.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        searchResultsContainer.innerHTML = '<p>An error occurred while searching. Please try again later.</p>';
    } finally {
        searchResultsContainer.classList.remove('hidden');
    }
}

async function fetchEpisodeCount(animeUrl) {
    try {
        const response = await fetch(animeUrl);
        if (!response.ok) throw new Error(`Failed to retrieve the webpage. Status code: ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const episodePageLinks = doc.querySelectorAll('#episode_page a');
        let maxEpisode = 0;

        episodePageLinks.forEach(link => {
            const epStart = parseInt(link.getAttribute('ep_start'));
            const epEnd = parseInt(link.getAttribute('ep_end'));
            if (epEnd > maxEpisode) {
                maxEpisode = epEnd;
            }
        });

        return maxEpisode;
    } catch (error) {
        console.error('Error occurred during request:', error);
        return 'Unknown'; // Default value in case of an error
    }
}

async function handleFetchDownloadLinks() {
    const startEpisode = parseInt(document.getElementById('startEpisode').value);
    const endEpisode = parseInt(document.getElementById('endEpisode').value);

    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = '';

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
    episodeListContainer.innerHTML = '';

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
