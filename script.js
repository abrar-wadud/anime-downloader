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
    }, 750); // 750ms delay
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
    const searchUrl = `https://anitaku.bz/search.html?keyword=${encodeURIComponent(query)}`;
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
                const episodeCount = await fetchEpisodeCount(`https://anitaku.bz${url}`);

                const resultItem = document.createElement('div');
                resultItem.classList.add('result-item');
                resultItem.dataset.url = `https://anitaku.bz${url}`;
                resultItem.dataset.title = title;
                resultItem.dataset.year = releasedYear;
                resultItem.dataset.imgSrc = imgSrc;
                resultItem.dataset.episodeCount = episodeCount; // Store episode count
                resultItem.innerHTML = `
                    <div class="result-img">
                        <img src="${imgSrc}" alt="${title}" loading="lazy"> <!-- Lazy loading enabled -->
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

async function fetchAnimeDetails(animeUrl) {
    try {
        const response = await fetch(animeUrl);
        if (!response.ok) throw new Error(`Failed to fetch anime page. Status code: ${response.status}`);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Extract movie_id and alias_anime
        const movieIdElement = doc.querySelector('.anime_info_episodes_next #movie_id');
        const aliasAnimeElement = doc.querySelector('.anime_info_episodes_next #alias_anime');

        const movieId = movieIdElement?.value || null;
        const aliasAnime = aliasAnimeElement?.value || null;

        if (!movieId || !aliasAnime) {
            throw new Error('Unable to retrieve movie ID or alias.');
        }

        // Return the values in an array for further use
        return [movieId, aliasAnime];
    } catch (error) {
        console.error('Error fetching anime details:', error);
        return [null, null]; // Ensure to return null in case of failure
    }
}

function validateEpisodeNumbers(startEpisode, endEpisode) {
    const minEpisode = 1; // minimum allowed episode number
    if (startEpisode < minEpisode) {
        showError(`Start episode number cannot be less than ${minEpisode}.`);
        return false;
    }
    if (endEpisode < minEpisode) {
        showError(`End episode number cannot be less than ${minEpisode}.`);
        return false;
    }
    if (startEpisode > endEpisode) {
        showError('Start episode number must be less than or equal to the end episode number.');
        return false;
    }
    return true;
}

async function handleFetchDownloadLinks() {
    const startEpisode = parseInt(document.getElementById('startEpisode').value);
    const endEpisode = parseInt(document.getElementById('endEpisode').value);
    const preferredResolution = document.getElementById('resolution').value + 'P';

    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = '';

    if (!validateEpisodeNumbers(startEpisode, endEpisode)) {
        return;
    }

    if (!selectedAnimeUrl) {
        showError('Please select an anime from the search results.');
        return;
    }

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('episodeList').innerHTML = '';

    try {
        const episodeOptions = await fetchDownloadLinks(selectedAnimeUrl, startEpisode, endEpisode, preferredResolution);
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

async function fetchDownloadLinks(animeUrl, startEpisode, endEpisode, preferredResolution) {
    const episodeOptions = [];
    const concurrentRequests = 5;
    const queue = [];
    let fetchedEpisodes = 0;

    // Show progress bar
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    progressContainer.classList.remove('hidden');

    // Get episodes from the API
    const episodes = await changeUrlFormat(animeUrl, startEpisode, endEpisode);

    // Handle fetching for each episode
    const totalEpisodes = episodes.length;
    for (const episode of episodes) {
        const { fullUrl, episodeTitle, episodeNumber } = episode;

        queue.push(scrapeEpisodePage(fullUrl, episodeTitle, episodeNumber, preferredResolution).then(result => {
            if (result) episodeOptions.push(result);
            fetchedEpisodes++;
            updateProgressBar(fetchedEpisodes, totalEpisodes, progressBar);
        }));

        // Ensure that the queue processes at least `concurrentRequests` or completes when done
        if (queue.length >= concurrentRequests) {
            await Promise.all(queue);
            queue.length = 0;  // Clear the queue
        }
    }

    // Ensure the remaining episodes in the queue are processed, even if there are fewer than `concurrentRequests`
    if (queue.length > 0) {
        await Promise.all(queue);
    }

    // Sort episodeOptions by episodeNumber before returning
    episodeOptions.sort((a, b) => a.episodeNumber - b.episodeNumber);

    // Hide progress bar when done
    progressContainer.classList.add('hidden');

    return episodeOptions;
}

// Function to update the progress bar
function updateProgressBar(fetchedEpisodes, totalEpisodes, progressBar) {
    const progressPercentage = (fetchedEpisodes / totalEpisodes) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

async function scrapeEpisodePage(url, episodeTitle, episodeNumber, preferredResolution) {
    try {
        // Step 1: Fetch the initial download page link
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to retrieve the webpage. Status code: ${response.status}`);
        
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const downloadPageLink = doc.querySelector('.favorites_book a[href^="http"]')?.getAttribute('href');
        
        if (!downloadPageLink) {
            return { title: episodeTitle, downloadLink: null, episodeNumber };
        }

        // Step 2: Extract the `id` parameter from the link
        const urlParams = new URLSearchParams(new URL(downloadPageLink).search);
        const id = urlParams.get('id');
        if (!id) {
            return { title: episodeTitle, downloadLink: null, episodeNumber };
        }

        // Step 3: Fetch the final download links using the extracted `id`
        const postResponse = await fetch("https://web-production-af65.up.railway.app/https://s3embtaku.pro/download", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "*/*"
            },
            body: `captcha_v3=03AFcWeA53xXdH1eEwxRn1DxZB7SrwJEzwT9T4ROw7wKvG2cjGov-BGpdUN1DoxyptuaMmuuADTQZeUGB13RrF18Zz6ZX_SdRy6W4S_G4WPUzqzhCgjrPil-W4Gtt7QU8jR3T49HVK-PxxliowX1q-mcplhKLYdb7Qd_V3vY0RZFcqwjjgCB0RsVAyYB8rjBYXKQugcK9ENTjnzpDTZnkNmF08bG-Y_nYHcDqm3KSXmEhMqhA1n_1TYmgGN_LRqLGFGvtp-jItLclT6M3FGJniYThkUlzgZWg-Niiuqys5T6RlrBUOLTvZgDC5uV7LC_VGH_AwPz_7DP3HUVGr3yANd2lqajz8GgC6umu8iRYSny2C32rPzSjO6gIgrQD1TUbdPVA2mSVOkpAQfJIyOW3iU_J-Ejc9u71hfrXm2LzzNF-LStk0hJCIkOESe2JRUb5N8Tf-CtPaGhnfNlYf75qax-bpOqogx_t250FXNQooX0rXW3BP1Hlo91l-LA2APd6y3HDTFMp1peFJdu8YyWf15xnWpwR4VyGToQZkkoznTjPWNP0xxne9pdBY29HGNHk2dLLc2UMKiV38IcX0ehqRQzBOFA_FCHW5Tfv4OYUm92veGgYCfDdwIIzDKzncUGWz42fcRTfq8yP5aXDJjkAYVOSjApN6mbzw8fNIYdY7vVu_skHAQ6713izx7yi5wtXVpsFPJH0BfgpLeM9fYMXHffoYCL_sQDKnBDr6J6omBG6543HzMyYsIDRI_ZJDLqBWHhZMLPDJilsCldv79HGORB1LsIvcM6oND1R-I5MQM4WPahlUFf55kn6Y6GvsjOuKMTblXTtL9B2VrbMoxRUm6CCA3VxcAL4DgQ&id=${id}` // Replace with full captcha payload
        });

        if (!postResponse.ok) throw new Error(`Failed to fetch download links. Status code: ${postResponse.status}`);
        
        const postHtml = await postResponse.text();
        const postDoc = new DOMParser().parseFromString(postHtml, 'text/html');
        
        // Step 4: Extract download links and prioritize the preferred resolution
        const resolutionOrder = ['1080P', '720P', '480P', '360P']; // Highest to lowest preference
        const availableLinks = Array.from(postDoc.querySelectorAll('.dowload a[href^="http"]')).map(link => {
            const resolutionMatch = link.textContent.match(/\((\d{3,4}P)/i);
            return {
                resolution: resolutionMatch ? resolutionMatch[1] : 'Unknown',
                downloadLink: link.getAttribute('href')
            };
        });

        // Select the preferred resolution or fallback
        let selectedLink = availableLinks.find(link => link.resolution === preferredResolution);
        if (!selectedLink) {
            for (const fallback of resolutionOrder) {
                selectedLink = availableLinks.find(link => link.resolution === fallback);
                if (selectedLink) break;
            }
        }

        if (!selectedLink) {
            return { title: episodeTitle, downloadLink: null, episodeNumber };
        }

        // Step 5: Return the download link for the selected resolution
        return { 
            title: episodeTitle, 
            downloadLink: selectedLink.downloadLink, 
            resolution: selectedLink.resolution, 
            episodeNumber 
        };

    } catch (error) {
        return { title: episodeTitle, downloadLink: null, episodeNumber };
    }
}

function displayEpisodeList(episodeOptions) {
    const episodeListContainer = document.getElementById('episodeList');
    episodeListContainer.innerHTML = '';

    const fragment = document.createDocumentFragment();
    episodeOptions.forEach(episode => {
        const episodeItem = document.createElement('div');
        episodeItem.classList.add('episode-item');
        episodeItem.innerHTML = `
            <a href="${episode.downloadLink}" target="_blank">
                ${episode.title}
                <span class="episode-resolution">- Resolution: ${episode.resolution || 'Unknown'}</span>
            </a>
        `;
        fragment.appendChild(episodeItem);
        episodeItem.addEventListener('click', function() {
            episodeItem.classList.add('clicked');
        });
    });
    episodeListContainer.appendChild(fragment);
    episodeListContainer.classList.remove('hidden');
}

async function changeUrlFormat(animeUrl, startEpisode, endEpisode) {
    // Await the result of fetchAnimeDetails to get the animeId and alias
    const [animeId, animeAlias] = await fetchAnimeDetails(animeUrl);

    if (!animeId || !animeAlias) {
        console.error('Failed to retrieve anime details.');
        return [];
    }

    // Construct the API URL
    const apiUrl = `https://ajax.gogocdn.net/ajax/load-list-episode?ep_start=${startEpisode}&ep_end=${endEpisode}&id=${animeId}&alias=${animeAlias}`;

    try {
        // Fetch the episode list
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Failed to fetch episode data: ${response.status}`);
        const html = await response.text();

        // Parse HTML response to extract links and titles
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const episodeElements = doc.querySelectorAll("#episode_related li a");

        // Build an array of episode URLs and titles
        const episodes = Array.from(episodeElements).map(el => {
            const relativeUrl = el.getAttribute("href").trim();
            const fullUrl = `https://anitaku.bz${relativeUrl}`; // Ensure the full URL
            const episodeTitle = el.querySelector(".name").textContent.trim();
            const episodeNumber = parseInt(episodeTitle.replace("EP", "").trim(), 10); // Extract episode number
            return { fullUrl, episodeTitle, episodeNumber };
        });
        return episodes;
    } catch (error) {
        console.error("Error in changeUrlFormat:", error);
        return [];
    }
}
