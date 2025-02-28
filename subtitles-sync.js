// ==LampaPlugin==
// Name: Subtitles Sync Pro
// Description: Improved plugin for loading subtitles via direct .srt links from Subadub and My-Subs
// Version: 2.0.0
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) {
        console.error('[SubtitlesSyncPro] Lampa environment not found');
        return;
    }

    const SubtitlesSyncPro = {
        name: 'SubtitlesSyncPro',
        version: '2.0.0',
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co'
        },
        languages: { en: 'English', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German' },
        settings: { source: 'My-Subs', language: 'en' },

        init() {
            if (!Lampa.Settings || !Lampa.PlayerMenu || !Lampa.Player || !Lampa.Menu) {
                console.error('[SubtitlesSyncPro] Required Lampa modules not found');
                return;
            }
            
            this.loadSettings();
            this.addSettings();
            this.addMenus();
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
            console.log(`[SubtitlesSyncPro] Plugin initialized (v${this.version})`);
        },

        loadSettings() {
            this.settings.source = Lampa.Storage.get('subtitles_source', 'My-Subs');
            this.settings.language = Lampa.Storage.get('subtitles_lang', 'en');
        },

        addSettings() {
            Lampa.Settings.add(this.name, {
                subtitles_source: {
                    name: 'Subtitles Source',
                    type: 'select',
                    values: this.sources,
                    default: this.settings.source,
                    onChange: (val) => this.updateSetting('source', val)
                },
                subtitles_lang: {
                    name: 'Subtitles Language',
                    type: 'select',
                    values: this.languages,
                    default: this.settings.language,
                    onChange: (val) => this.updateSetting('language', val)
                }
            });
        },

        updateSetting(key, value) {
            this.settings[key] = value;
            Lampa.Storage.set(`subtitles_${key}`, value);
            console.log(`[SubtitlesSyncPro] Updated ${key}:`, value);
        },

        addMenus() {
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Load subtitles from sources',
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

        showSubtitlesMenu() {
            const movie = Lampa.Player.data?.movie;
            if (!movie) {
                Lampa.Noty.show('No movie data available');
                return;
            }
            
            Lampa.Select.show({
                title: `Subtitles for: ${movie.title || movie.name}`,
                items: [
                    { title: 'Load Subtitles', action: 'search' },
                    { title: 'Load Manually', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.loadSubtitles(movie);
                    else this.manualUpload();
                }
            });
        },

        loadSubtitles(movie) {
            Lampa.Noty.show('Searching for subtitles...');
            const query = encodeURIComponent(movie.title.toLowerCase().replace(/ /g, '-'));
            const url = `${this.sources[this.settings.source]}/subtitles/${query}-${this.settings.language}.srt`;
            
            console.log('[SubtitlesSyncPro] Fetching:', url);
            fetch(url, { headers: { 'Accept': 'text/plain' } })
                .then(res => res.ok ? res.text() : Promise.reject(`Error ${res.status}`))
                .then(text => {
                    this.applySubtitles(text);
                    Lampa.Noty.show('Subtitles loaded successfully');
                })
                .catch(err => {
                    console.error('[SubtitlesSyncPro] Load error:', err);
                    Lampa.Noty.show('Failed to load subtitles');
                });
        },

        applySubtitles(srtText) {
            Lampa.Player.subtitles.add({
                label: `${this.languages[this.settings.language]} - ${this.settings.source}`,
                content: this.parseSRT(srtText)
            });
        },

        parseSRT(srtText) {
            return srtText.split('\n\n').map(block => {
                const lines = block.split('\n');
                return { id: lines[0], text: lines.slice(2).join(' ') };
            });
        },

        manualUpload() {
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

        onPlayer(e) {
            if (e.type === 'start') {
                console.log('[SubtitlesSyncPro] Player started');
            }
        }
    };

    try {
        SubtitlesSyncPro.init();
        window.Lampa.Plugins = window.Lampa.Plugins || {};
        window.Lampa.Plugins[SubtitlesSyncPro.name] = SubtitlesSyncPro;
        console.log('[SubtitlesSyncPro] Plugin loaded successfully');
    } catch (e) {
        console.error('[SubtitlesSyncPro] Initialization error:', e);
        Lampa.Noty.show('Plugin initialization failed');
    }
})();
