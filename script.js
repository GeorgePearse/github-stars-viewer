// GitHub language colors (subset)
const LANGUAGE_COLORS = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'Python': '#3572A5',
    'Java': '#b07219',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'Ruby': '#701516',
    'PHP': '#4F5D95',
    'C++': '#f34b7d',
    'C': '#555555',
    'C#': '#178600',
    'Swift': '#ffac45',
    'Kotlin': '#A97BFF',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Shell': '#89e051',
    'Vue': '#41b883',
    'React': '#61dafb'
};

class GitHubStarsViewer {
    constructor() {
        this.allRepos = [];
        this.filteredRepos = [];
        this.currentUsername = '';
        this.currentCluster = 'all';

        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('loadStars').addEventListener('click', () => this.loadStars());
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadStars();
        });
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('languageFilter').addEventListener('change', (e) => this.handleLanguageFilter(e.target.value));
        document.getElementById('sortBy').addEventListener('change', (e) => this.handleSort(e.target.value));
    }

    async loadStars() {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            this.showError('Please enter a GitHub username');
            return;
        }

        this.currentUsername = username;
        this.showLoading(true);
        this.hideError();
        this.hideControls();

        try {
            const repos = await this.fetchAllStarredRepos(username);
            this.allRepos = repos;
            this.filteredRepos = repos;

            this.updateStats();
            this.populateLanguageFilter();
            this.createClusters();
            this.displayRepos();
            this.showControls();

            // Fetch and display recommendations
            this.fetchRecommendations();
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchAllStarredRepos(username) {
        let page = 1;
        let allRepos = [];
        const perPage = 100;

        while (true) {
            const response = await fetch(
                `https://api.github.com/users/${username}/starred?per_page=${perPage}&page=${page}`
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found');
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const repos = await response.json();
            if (repos.length === 0) break;

            allRepos = allRepos.concat(repos);
            page++;

            // Update loading message
            document.querySelector('.loading p').textContent =
                `Loading starred repositories... (${allRepos.length} loaded)`;

            // GitHub API rate limit: be nice
            if (repos.length < perPage) break;
        }

        return allRepos;
    }

    async fetchRecommendations() {
        // Analyze user's starred repos to find patterns
        const languages = {};
        const topics = {};

        this.allRepos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
            if (repo.topics) {
                repo.topics.forEach(topic => {
                    topics[topic] = (topics[topic] || 0) + 1;
                });
            }
        });

        // Find top 3 languages and topics
        const topLanguages = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang);

        const topTopics = Object.entries(topics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);

        // Search for trending repos in these categories
        try {
            const recommendations = await this.searchRecommendations(topLanguages, topTopics);
            this.displayRecommendations(recommendations);
        } catch (error) {
            console.error('Could not fetch recommendations:', error);
        }
    }

    async searchRecommendations(languages, topics) {
        const starredRepoIds = new Set(this.allRepos.map(r => r.id));
        const recommendations = [];

        // Search by top topics
        for (const topic of topics.slice(0, 3)) {
            try {
                const response = await fetch(
                    `https://api.github.com/search/repositories?q=topic:${topic}+stars:>100&sort=stars&per_page=10`
                );
                if (response.ok) {
                    const data = await response.json();
                    const newRepos = data.items.filter(repo => !starredRepoIds.has(repo.id));
                    recommendations.push(...newRepos);
                }
            } catch (e) {
                console.error(`Error searching topic ${topic}:`, e);
            }
        }

        // Deduplicate and limit
        const uniqueRecommendations = Array.from(
            new Map(recommendations.map(r => [r.id, r])).values()
        ).slice(0, 10);

        return uniqueRecommendations;
    }

    displayRecommendations(recommendations) {
        if (recommendations.length === 0) return;

        // Add a recommendations section
        const repoContainer = document.getElementById('repositories');

        const recSection = document.createElement('div');
        recSection.className = 'recommendations-section';
        recSection.innerHTML = '<h2 style="color: white; margin-bottom: 20px;">💡 Recommended for You</h2>';

        const recGrid = document.createElement('div');
        recGrid.className = 'repositories';

        recommendations.forEach(repo => {
            const card = this.createRepoCard(repo, true);
            recGrid.appendChild(card);
        });

        recSection.appendChild(recGrid);
        repoContainer.parentNode.insertBefore(recSection, repoContainer);
    }

    createClusters() {
        const languages = {};
        const topics = {};

        this.allRepos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
            if (repo.topics) {
                repo.topics.forEach(topic => {
                    topics[topic] = (topics[topic] || 0) + 1;
                });
            }
        });

        const clusterTabs = document.getElementById('clusterTabs');
        clusterTabs.innerHTML = '';

        // All tab
        const allTab = this.createClusterTab('All', this.allRepos.length, 'all');
        clusterTabs.appendChild(allTab);

        // Language tabs (top 8)
        const topLanguages = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        topLanguages.forEach(([lang, count]) => {
            const tab = this.createClusterTab(lang, count, `lang:${lang}`);
            clusterTabs.appendChild(tab);
        });

        // Topic tabs (top 8)
        const topTopics = Object.entries(topics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        topTopics.forEach(([topic, count]) => {
            const tab = this.createClusterTab(`#${topic}`, count, `topic:${topic}`);
            clusterTabs.appendChild(tab);
        });

        document.getElementById('clusters').classList.remove('hidden');
    }

    createClusterTab(label, count, clusterId) {
        const tab = document.createElement('div');
        tab.className = `cluster-tab ${clusterId === 'all' ? 'active' : ''}`;
        tab.innerHTML = `${label} <span style="opacity: 0.7">(${count})</span>`;
        tab.addEventListener('click', () => this.handleClusterClick(clusterId, tab));
        return tab;
    }

    handleClusterClick(clusterId, clickedTab) {
        // Update active tab
        document.querySelectorAll('.cluster-tab').forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');

        this.currentCluster = clusterId;
        this.applyFilters();
    }

    applyFilters() {
        let filtered = this.allRepos;

        // Apply cluster filter
        if (this.currentCluster !== 'all') {
            if (this.currentCluster.startsWith('lang:')) {
                const lang = this.currentCluster.substring(5);
                filtered = filtered.filter(repo => repo.language === lang);
            } else if (this.currentCluster.startsWith('topic:')) {
                const topic = this.currentCluster.substring(6);
                filtered = filtered.filter(repo => repo.topics && repo.topics.includes(topic));
            }
        }

        // Apply language filter
        const langFilter = document.getElementById('languageFilter').value;
        if (langFilter) {
            filtered = filtered.filter(repo => repo.language === langFilter);
        }

        // Apply search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(repo =>
                repo.name.toLowerCase().includes(searchTerm) ||
                (repo.description && repo.description.toLowerCase().includes(searchTerm)) ||
                (repo.topics && repo.topics.some(t => t.includes(searchTerm)))
            );
        }

        this.filteredRepos = filtered;
        this.handleSort(document.getElementById('sortBy').value);
    }

    handleSearch(searchTerm) {
        this.applyFilters();
    }

    handleLanguageFilter(language) {
        this.applyFilters();
    }

    handleSort(sortBy) {
        let sorted = [...this.filteredRepos];

        switch(sortBy) {
            case 'stars':
                sorted.sort((a, b) => b.stargazers_count - a.stargazers_count);
                break;
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'updated':
                sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                break;
            case 'recent':
            default:
                // Already in order from API (most recently starred first)
                break;
        }

        this.filteredRepos = sorted;
        this.displayRepos();
    }

    updateStats() {
        const languages = new Set(this.allRepos.map(r => r.language).filter(Boolean));

        document.getElementById('totalStars').textContent =
            `${this.allRepos.length} stars`;
        document.getElementById('languageCount').textContent =
            `${languages.size} languages`;
        document.getElementById('stats').classList.remove('hidden');
    }

    populateLanguageFilter() {
        const languages = [...new Set(this.allRepos.map(r => r.language).filter(Boolean))];
        languages.sort();

        const select = document.getElementById('languageFilter');
        select.innerHTML = '<option value="">All Languages</option>';

        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            select.appendChild(option);
        });
    }

    displayRepos() {
        const container = document.getElementById('repositories');
        container.innerHTML = '';

        if (this.filteredRepos.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white; padding: 40px;">No repositories found</div>';
            return;
        }

        this.filteredRepos.forEach(repo => {
            const card = this.createRepoCard(repo);
            container.appendChild(card);
        });
    }

    createRepoCard(repo, isRecommendation = false) {
        const card = document.createElement('a');
        card.className = 'repo-card';
        card.href = repo.html_url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const languageColor = LANGUAGE_COLORS[repo.language] || '#666';

        let topicsHTML = '';
        if (repo.topics && repo.topics.length > 0) {
            topicsHTML = `
                <div class="repo-topics">
                    ${repo.topics.slice(0, 5).map(topic =>
                        `<span class="topic-tag">${topic}</span>`
                    ).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="repo-header">
                <div class="repo-name">${repo.full_name || repo.name}</div>
                <div class="repo-stars">⭐ ${this.formatNumber(repo.stargazers_count)}</div>
            </div>
            <div class="repo-description">${repo.description || 'No description available'}</div>
            <div class="repo-footer">
                ${repo.language ? `
                    <div class="repo-language">
                        <span class="language-color" style="background-color: ${languageColor}"></span>
                        <span>${repo.language}</span>
                    </div>
                ` : ''}
            </div>
            ${topicsHTML}
            ${isRecommendation ? '<div style="margin-top: 10px; font-size: 12px; color: #667eea; font-weight: 600;">💡 Recommended</div>' : ''}
        `;

        return card;
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    showControls() {
        document.getElementById('controls').classList.remove('hidden');
    }

    hideControls() {
        document.getElementById('controls').classList.add('hidden');
    }
}

// Initialize the app
const app = new GitHubStarsViewer();
