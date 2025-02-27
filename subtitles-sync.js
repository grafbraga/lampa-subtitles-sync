// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for searching and syncing subtitles from open sources
// Version: 1.0.3
// Author: Grok3-xAI
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) {
        console.error('[SubtitlesSync] Lampa environment not found');
        return;
    }

    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.3',
        proxy: 'https://cors-anywhere.herokuapp.com/', // Прокси для обхода CORS
        sources: {
            'Subadub': 'https://subadub.app',
            'Subscene': 'https://subscene.com',
            'GetSubad': 'https://getsubad.com'
        },
        defaultSource: 'Subscene',
        languages: ['en', 'ru', 'es', 'fr', 'de'],
        selectedLang: 'en',
        selectedSource: 'Subscene',

        init: function () {
            if (!Lampa.Settings || !Lampa.PlayerMenu || !Lampa.Player) {
                console.error('[SubtitlesSync] Required Lampa modules not found');
                return;
            }
            this.addSettings();
            this.injectMenu();
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
            console.log('[SubtitlesSync] Plugin initialized');
        },

        addSettings: function () {
            Lampa.Settings.add(this.name, {
                subtitles_source: {
                    name: 'Subtitles Source',
                    type: 'select',
                    values: this.sources,
                    default: this.defaultSource,
                    onChange: (value) => {
                        this.selectedSource = value;
                        Lampa.Storage.set('subtitles_source', value);
                    }
                },
                subtitles_lang: {
                    name: 'Subtitles Language',
                    type: 'select',
                    values: this.languages.reduce((acc, lang) => {
                        acc[lang] = lang.toUpperCase();
                        return acc;
                    }, {}),
                    default: this.selectedLang,
                    onChange: (value) => {
                        this.selectedLang = value;
                        Lampa.Storage.set('subtitles_lang', value);
                    }
                }
            });

            this.selectedSource = Lampa.Storage.get('subtitles_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_lang', this.selectedLang);
        },

        injectMenu: function () {
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Search and sync subtitles',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
        },

        showSubtitlesMenu: function () {
            const film = Lampa.Player.data;
            if (!film || !film.movie) {
                Lampa.Noty.show('No movie data available');
                return;
            }

            const movieTitle = film.movie.title || film.movie.name;
            const movieYear = film.movie.year || '';

            Lampa.Select.show({
                title: 'Subtitles for: ' + movieTitle,
                items: [
                    { title: 'Search Subtitles', action: 'search' },
                    { title: 'Load Manually', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.searchSubtitles(movieTitle, movieYear);
                    else if (item.action === 'manual') this.manualUpload();
                }
            });
        },

        searchSubtitles: function (title, year) {
            Lampa.Noty.show('Searching subtitles...');
            const query = encodeURIComponent(`${title} ${year} ${this.selectedLang}`);
            const sourceUrl = this.sources[this.selectedSource];
            let subtitlesUrl;

            if (this.selectedSource === 'Subadub') {
                subtitlesUrl = `${this.proxy}${sourceUrl}/search?q=${query}`;
            } else if (this.selectedSource === 'Subscene') {
                subtitlesUrl = `${this.proxy}${sourceUrl}/subtitles/searchbytitle?query=${query}`;
            } else if (this.selectedSource === 'GetSubad') {
                subtitlesUrl = `${this.proxy}${sourceUrl}/search?query=${query}`;
            }

            console.log('[SubtitlesSync] Fetching:', subtitlesUrl);

            fetch(subtitlesUrl, { headers: { 'Origin': window.location.origin } })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                    return response.text();
                })
                .then(text => {
                    const subtitles = this.parseSubtitles(text, this.selectedSource);
                    if (subtitles.length) {
                        this.showSubtitlesList(subtitles);
                    } else {
                        Lampa.Noty.show('No subtitles found');
                    }
                })
                .catch(e => {
                    console.error('[SubtitlesSync] Search error:', e);
                    Lampa.Noty.show('Request error: ' + e.message);
                });
        },

        parseSubtitles: function (html, source) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const subtitles = [];

            try {
                if (source === 'Subadub') {
                    const links = doc.querySelectorAll('a[href*=".srt"]');
                    links.forEach(link => {
                        subtitles.push({ title: link.textContent.trim(), url: link.href });
                    });
                } else if (source === 'Subscene') {
                    const links = doc.querySelectorAll('a[href*="/subtitles/"]');
                    links.forEach(link => {
                        const title = link.textContent.trim();
                        const href = `https://subscene.com${link.getAttribute('href')}`;
                        subtitles.push({ title, url: href });
                    });
                } else if (source === 'GetSubad') {
                    const links = doc.querySelectorAll('a[href*=".srt"]');
                    links.forEach(link => {
                        subtitles.push({ title: link.textContent.trim(), url: link.href });
                    });
                }
            } catch (e) {
                console.error('[SubtitlesSync] Parse error:', e);
            }

            return subtitles.slice(0, 5);
        },

        showSubtitlesList: function (subtitles) {
            Lampa.Select.show({
                title: 'Select Subtitles',
                items: subtitles.map(sub => ({ title: sub.title })),
                onSelect: (item) => {
                    const selected = subtitles.find(sub => sub.title === item.title);
                    this.loadSubtitles(selected.url, this.selectedSource);
                }
            });
        },

        loadSubtitles: function (url, source) {
            if (source === 'Subscene') {
                fetch(`${this.proxy}${url}`, { headers: { 'Origin': window.location.origin } })
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                        return res.text();
                    })
                    .then(text => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/html');
                        const downloadLink = doc.querySelector('a[href*="/subtitle/download"]');
                        if (downloadLink) {
                            this.fetchSubtitlesFile(downloadLink.href);
                        } else {
                            Lampa.Noty.show('Download link not found');
                        }
                    })
                    .catch(e => {
                        console.error('[SubtitlesSync] Subscene load error:', e);
                        Lampa.Noty.show('Request error: ' + e.message);
                    });
            } else {
                this.fetchSubtitlesFile(url);
            }
        },

        fetchSubtitlesFile: function (url) {
            fetch(`${this.proxy}${url}`, { headers: { 'Origin': window.location.origin } })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                    return response.text();
                })
                .then(srtText => {
                    this.applySubtitles(srtText);
                    Lampa.Noty.show('Subtitles loaded');
                })
                .catch(e => {
                    console.error('[SubtitlesSync] File load error:', e);
                    Lampa.Noty.show('Request error: ' + e.message);
                });
        },

        applySubtitles: function (srtText) {
            const player = Lampa.Player;
            player.subtitles.add({
                label: `${this.selectedLang.toUpperCase()} - ${this.selectedSource}`,
                content: this.parseSRT(srtText)
            });
        },

        parseSRT: function (srtText) {
            const lines = srtText.split('\n');
            const subtitles = [];
            let current = null;

            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                if (!isNaN(line) && !current) {
                    current = { id: parseInt(line) };
                } else if (line.includes('-->')) {
                    const [start, end] = line.split(' --> ');
                    current.start = this.timeToSeconds(start);
                    current.end = this.timeToSeconds(end);
                } else if (current && !current.text) {
                    current.text = line;
                    subtitles.push(current);
                    current = null;
                }
            }

            return subtitles;
        },

        timeToSeconds: function (time) {
            const [hours, minutes, seconds] = time.replace(',', '.').split(':');
            return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        },

        manualUpload: function () {
            if (!Lampa.File) {
                Lampa.Noty.show('File upload not supported');
                return;
            }
            Lampa.File.upload({
                accept: '.srt,.sub',
                callback: (files) => {
                    if (files.length) {
                        const reader = new FileReader();
                        reader.onload = (e) => this.applySubtitles(e.target.result);
                        reader.readAsText(files[0]);
                    }
                }
            });
        },

        onPlayer: function (e) {
            if (e.type === 'start') {
                // Автоматический поиск можно добавить позже
            }
        }
    };

    try {
        SubtitlesSync.init();
        window.Lampa.Plugins = window.Lampa.Plugins || {};
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
        console.log('[SubtitlesSync] Plugin loaded successfully');
    } catch (e) {
        console.error('[SubtitlesSync] Initialization error:', e);
        Lampa.Noty.show('Plugin initialization failed');
    }
})();
