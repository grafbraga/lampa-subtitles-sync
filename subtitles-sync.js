// ==LampaPlugin==
// Name: Subtitles Sync Enhanced
// Description: Enhanced plugin for loading subtitles from Subadub and My-Subs with improved error handling and support.
// Version: 2.0.0
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) {
        console.error('[SubtitlesSync] Lampa environment not found');
        return;
    }

    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '2.0.0',
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co'
        },
        defaultSource: 'My-Subs',
        languages: ['en', 'ru', 'es', 'fr', 'de'],
        selectedLang: 'en',
        selectedSource: 'My-Subs',

        init: function () {
            if (!Lampa.Settings || !Lampa.PlayerMenu || !Lampa.Player || !Lampa.Menu) {
                console.error('[SubtitlesSync] Required Lampa modules not found');
                return;
            }
            this.loadSettings();
            this.addSettings();
            this.injectMenus();
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
            console.log('[SubtitlesSync] Plugin initialized successfully');
        },

        loadSettings: function () {
            this.selectedSource = Lampa.Storage.get('subtitles_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_lang', this.selectedLang);
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
                        console.log('[SubtitlesSync] Source changed to:', value);
                    }
                },
                subtitles_lang: {
                    name: 'Subtitles Language',
                    type: 'select',
                    values: Object.fromEntries(this.languages.map(lang => [lang, lang.toUpperCase()])),
                    default: this.selectedLang,
                    onChange: (value) => {
                        this.selectedLang = value;
                        Lampa.Storage.set('subtitles_lang', value);
                        console.log('[SubtitlesSync] Language changed to:', value);
                    }
                }
            });
        },

        injectMenus: function () {
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Load subtitles via direct links',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
            Lampa.Menu.add({
                title: 'Subtitles Sync Settings',
                subtitle: 'Configure subtitles source and language',
                icon: 'settings',
                action: () => {
                    Lampa.Settings.show({
                        category: this.name,
                        title: 'Subtitles Sync Settings'
                    });
                }
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
                    { title: 'Load Subtitles', action: 'search' },
                    { title: 'Load Manually', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.loadSubtitlesDirect(movieTitle, movieYear);
                    else if (item.action === 'manual') this.manualUpload();
                }
            });
        },

        async loadSubtitlesDirect(title, year) {
            Lampa.Noty.show('Loading subtitles...');
            const query = encodeURIComponent(title.toLowerCase().replace(/ /g, '-'));
            let subtitlesUrl;

            if (this.selectedSource === 'Subadub') {
                subtitlesUrl = `${this.sources.Subadub}/subtitles/${query}-${this.selectedLang}.srt`;
            } else {
                subtitlesUrl = `${this.sources['My-Subs']}/subtitles/${query}-${year}-${this.selectedLang}.srt`;
            }

            try {
                const response = await fetch(subtitlesUrl, { headers: { 'Accept': 'text/plain' } });
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                const srtText = await response.text();
                this.applySubtitles(srtText);
                Lampa.Noty.show('Subtitles loaded successfully');
            } catch (e) {
                console.error('[SubtitlesSync] Load error:', e);
                Lampa.Noty.show('Failed to load subtitles: ' + e.message);
            }
        },

        applySubtitles: function (srtText) {
            const player = Lampa.Player;
            player.subtitles.add({
                label: `${this.selectedLang.toUpperCase()} - ${this.selectedSource}`,
                content: this.parseSRT(srtText)
            });
        },

        parseSRT: function (srtText) {
            return srtText.split('\n').reduce((acc, line) => {
                line = line.trim();
                if (!line) return acc;
                if (!isNaN(line)) acc.push({ id: parseInt(line) });
                else if (line.includes('-->')) {
                    const [start, end] = line.split(' --> ');
                    acc[acc.length - 1].start = this.timeToSeconds(start);
                    acc[acc.length - 1].end = this.timeToSeconds(end);
                } else acc[acc.length - 1].text = (acc[acc.length - 1].text || '') + '\n' + line;
                return acc;
            }, []);
        },

        timeToSeconds: function (time) {
            const [hours, minutes, seconds] = time.replace(',', '.').split(':');
            return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        },
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
