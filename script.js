document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('episodeList').classList.remove('hidden');
});

document.getElementById('animeForm').addEventListener('submit', function(event) {
    event.preventDefault();
    handleAnimeDownload();
});

async function handleAnimeDownload() {
    const animeUrl = document.getElementById('animeUrl').value.trim();
    const startEpisode = parseInt(document.getElementById('startEpisode').value);
    const endEpisode = parseInt(document.getElementById('endEpisode').value);

    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = ''; // Clear previous errors

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
        const episodeOptions = await scrapeEpisodes(animeUrl, startEpisode, endEpisode);
        displayEpisodeList(episodeOptions);
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while fetching episodes. Please try again later.');
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

async function scrapeEpisodes(animeUrl, startEpisode, endEpisode) {
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

function changeUrlFormat(animeUrl, episodeNumber) {
    const base_url = animeUrl.split('category/')[0];
    const anime_title = animeUrl.split('/').pop();
    const episodeUrl = base_url + anime_title + '-episode-' + episodeNumber;
    return episodeUrl;
}
