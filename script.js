document.addEventListener('DOMContentLoaded', function() {
    // Ensure the episode list is visible
    document.getElementById('episodeList').classList.remove('hidden');
});

document.getElementById('animeForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    handleAnimeDownload(event);
});

async function handleAnimeDownload(event) {
    const animeUrl = document.getElementById('animeUrl').value.trim();
    const startEpisode = parseInt(document.getElementById('startEpisode').value);
    const endEpisode = parseInt(document.getElementById('endEpisode').value);

    // Error handling for negative episode numbers or invalid ranges
    if (isNaN(startEpisode) || isNaN(endEpisode) || startEpisode < 0 || endEpisode < 0 || startEpisode > endEpisode) {
        alert('Please enter valid episode numbers.');
        return;
    }

    document.getElementById('loading').style.display = 'block';
    document.getElementById('episodeList').innerHTML = '';

    try {
        // Fetching download links
        const episodeOptions = await scrapeEpisodes(animeUrl, startEpisode, endEpisode);
        displayEpisodeList(episodeOptions);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}


async function scrapeEpisodes(animeUrl, startEpisode, endEpisode) {
    const episodeOptions = [];
    const concurrentRequests = 5; // Number of simultaneous requests
    const promises = [];

    // Create an array of promises for scraping multiple episode links
    for (let episodeNumber = startEpisode; episodeNumber <= endEpisode; episodeNumber++) {
        const episodeUrl = changeUrlFormat(animeUrl, episodeNumber);
        const episodeTitle = `Episode ${episodeNumber}`;
        promises.push(scrapeEpisodePage(episodeUrl, episodeTitle));

        // Wait for all promises to resolve if reached the maximum number of concurrent requests
        if (promises.length >= concurrentRequests || episodeNumber === endEpisode) {
            const results = await Promise.all(promises);
            episodeOptions.push(...results.filter(link => link)); // Filter out null values
            promises.length = 0; // Reset promises array
        }
    }

    return episodeOptions;
}

function displayEpisodeList(episodeOptions) {
    const episodeListContainer = document.getElementById('episodeList');
    episodeListContainer.innerHTML = ''; // Clear previous episodes

    // Create list items for each episode
    episodeOptions.forEach(episode => {
        const listItem = document.createElement('div');
        listItem.classList.add('episode-item');
        listItem.innerHTML = `<a href="${episode.downloadLink}" target="_blank">${episode.title}</a>`;
        episodeListContainer.appendChild(listItem);
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

        // Optimize the selector to directly target the download link
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
