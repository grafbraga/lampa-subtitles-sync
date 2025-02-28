// ==LampaPlugin==
// Name: Subtitles Sync Enhanced
// Description: Advanced plugin for loading subtitles from Subadub and My-Subs with robust error handling and enhanced features
// Version: 3.0.0
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    // Safety check - wait for Lampa to be fully loaded
    function waitForLampa(callback, attempts = 0) {
        if (window.Lampa && 
            window.Lampa.Settings && 
            window.Lampa.PlayerMenu && 
            window.Lampa.Player && 
            window.Lampa.Menu) {
            callback();
        } else if (attempts < 20) { // Maximum 10 seconds (20 attempts × 500ms)
            setTimeout(() => waitForLampa(callback, attempts + 1), 500);
        } else {
            console.error('[SubtitlesSync] Lampa environment not found after multiple attempts');
        }
    }

    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '3.0.0',
        // Use CORS proxies to avoid direct access issues
        cors_proxy: 'https://cors-anywhere.herokuapp.com/',
        alternative_proxy: 'https://api.allorigins.win/raw?url=',
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co',
            'OpenSubtitles': 'https://opensubtitles.com',
            'Subscene': 'https://subscene.com'
        },
        defaultSource: 'My-Subs',
        languages: ['en', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
        selectedLang: 'en',
        selectedSource: 'My-Subs',
        useProxy: true,
        autoLoadSubs: false,
        settingsKey: 'subtitles_sync_settings',

        init: function () {
            this.loadSettings();
            this.addSettings();
            this.injectMenus();
            this.attachPlayerEvents();
            console.log('[SubtitlesSync] Plugin initialized successfully');
        },

        loadSettings: function () {
            try {
                const savedSettings = Lampa.Storage.get(this.settingsKey, {});
                this.selectedSource = savedSettings.source || this.defaultSource;
                this.selectedLang = savedSettings.lang || this.selectedLang;
                this.useProxy = savedSettings.useProxy !== undefined ? savedSettings.useProxy : true;
                this.autoLoadSubs = savedSettings.autoLoadSubs || false;
            } catch (e) {
                console.error('[SubtitlesSync] Settings load error:', e);
                // Use defaults if settings couldn't be loaded
            }
        },

        saveSettings: function () {
            try {
                Lampa.Storage.set(this.settingsKey, {
                    source: this.selectedSource,
                    lang: this.selectedLang,
                    useProxy: this.useProxy,
                    autoLoadSubs: this.autoLoadSubs
                });
            } catch (e) {
                console.error('[SubtitlesSync] Settings save error:', e);
                Lampa.Noty.show('Failed to save settings');
            }
        },

        addSettings: function () {
            const settingsObject = {
                subtitles_source: {
                    name: 'Subtitles Source',
                    type: 'select',
                    values: this.sources,
                    default: this.selectedSource,
                    onChange: (value) => {
                        this.selectedSource = value;
                        this.saveSettings();
                    }
                },
                subtitles_lang: {
                    name: 'Subtitles Language',
                    type: 'select',
                    values: Object.fromEntries(this.languages.map(lang => [lang, lang.toUpperCase()])),
                    default: this.selectedLang,
                    onChange: (value) => {
                        this.selectedLang = value;
                        this.saveSettings();
                    }
                },
                use_proxy: {
                    name: 'Use CORS Proxy',
                    type: 'toggle',
                    default: this.useProxy,
                    onChange: (value) => {
                        this.useProxy = value;
                        this.saveSettings();
                    }
                },
                auto_load: {
                    name: 'Auto-load Subtitles',
                    type: 'toggle',
                    default: this.autoLoadSubs,
                    onChange: (value) => {
                        this.autoLoadSubs = value;
                        this.saveSettings();
                    }
                },
                reset_settings: {
                    name: 'Reset Settings',
                    type: 'button',
                    onClick: () => {
                        this.selectedSource = this.defaultSource;
                        this.selectedLang = 'en';
                        this.useProxy = true;
                        this.autoLoadSubs = false;
                        this.saveSettings();
                        Lampa.Settings.update();
                        Lampa.Noty.show('Settings reset to defaults');
                    }
                }
            };

            try {
                Lampa.Settings.inject(this.name, settingsObject);
            } catch (e) {
                // Fallback method if inject fails
                console.warn('[SubtitlesSync] Using fallback settings method');
                Lampa.Settings.add(this.name, settingsObject);
            }
        },

        injectMenus: function () {
            // Add to player menu
            if (Lampa.PlayerMenu && typeof Lampa.PlayerMenu.add === 'function') {
                Lampa.PlayerMenu.add({
                    title: 'Subtitles Sync',
                    subtitle: 'Load subtitles for current video',
                    icon: 'subtitles',
                    id: 'subtitles_sync',
                    onCustom: () => this.showSubtitlesMenu()
                });
            } else {
                console.warn('[SubtitlesSync] PlayerMenu not available for injection');
            }

            // Add to main menu
            if (Lampa.Menu && typeof Lampa.Menu.append === 'function') {
                try {
                    Lampa.Menu.append({
                        id: 'subtitles_sync_menu',
                        title: 'Subtitles Sync',
                        icon: 'subtitles',
                        order: 105,
                        create: () => {
                            const menu = [];
                            
                            menu.push({
                                title: 'Subtitles Settings',
                                subtitle: 'Configure subtitles source and language',
                                icon: 'settings',
                                action: () => {
                                    Lampa.Settings.open('SubtitlesSync');
                                }
                            });
                            
                            return menu;
                        }
                    });
                } catch (e) {
                    console.warn('[SubtitlesSync] Menu append error:', e);
                    // Fallback method
                    if (typeof Lampa.Menu.add === 'function') {
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
                    }
                }
            }
        },

        attachPlayerEvents: function () {
            Lampa.Listener.follow('player', (event) => {
                if (event.type === 'start' && this.autoLoadSubs) {
                    // Wait for player to fully initialize
                    setTimeout(() => {
                        try {
                            const movieData = Lampa.Player.video ? Lampa.Player.video.dataset : null;
                            const title = movieData ? (movieData.title || movieData.name) : null;
                            const year = movieData ? movieData.year : null;
                            
                            if (title) {
                                this.loadSubtitlesDirect(title, year);
                            }
                        } catch (e) {
                            console.error('[SubtitlesSync] Auto-load error:', e);
                        }
                    }, 2000);
                }
            });
        },

        showSubtitlesMenu: function () {
            let title = '';
            let year = '';
            
            try {
                // Try multiple methods to get the movie title and year
                if (Lampa.Player && Lampa.Player.currentItem) {
                    const item = Lampa.Player.currentItem();
                    if (item && item.title) title = item.title;
                    if (item && item.year) year = item.year;
                }
                
                if (!title && Lampa.Player && Lampa.Player.video) {
                    const data = Lampa.Player.video.dataset;
                    title = data.title || data.name || '';
                    year = data.year || '';
                }
                
                if (!title && Lampa.Player && Lampa.Player.data) {
                    const movie = Lampa.Player.data.movie;
                    if (movie) {
                        title = movie.title || movie.name || '';
                        year = movie.year || '';
                    }
                }
            } catch (e) {
                console.error('[SubtitlesSync] Error getting movie data:', e);
            }

            if (!title) {
                Lampa.Noty.show('Could not identify the current movie');
                return;
            }

            Lampa.Select.show({
                title: 'Subtitles for: ' + title,
                items: [
                    { title: 'Search Online', subtitle: 'From ' + this.selectedSource, value: 'search' },
                    { title: 'Manual URL', subtitle: 'Paste direct subtitle URL', value: 'manual' },
                    { title: 'Change Language', subtitle: 'Current: ' + this.selectedLang.toUpperCase(), value: 'language' },
                    { title: 'Change Source', subtitle: 'Current: ' + this.selectedSource, value: 'source' }
                ],
                onSelect: (item) => {
                    if (item.value === 'search') this.loadSubtitlesDirect(title, year);
                    else if (item.value === 'manual') this.manualUrlInput();
                    else if (item.value === 'language') this.showLanguageSelector();
                    else if (item.value === 'source') this.showSourceSelector();
                }
            });
        },

        showLanguageSelector: function() {
            const items = this.languages.map(lang => ({
                title: lang.toUpperCase(),
                selected: lang === this.selectedLang,
                value: lang
            }));
            
            Lampa.Select.show({
                title: 'Select Subtitle Language',
                items: items,
                onSelect: (item) => {
                    this.selectedLang = item.value;
                    this.saveSettings();
                    Lampa.Noty.show('Language set to ' + item.value.toUpperCase());
                }
            });
        },
        
        showSourceSelector: function() {
            const items = Object.keys(this.sources).map(source => ({
                title: source,
                selected: source === this.selectedSource,
                value: source
            }));
            
            Lampa.Select.show({
                title: 'Select Subtitles Source',
                items: items,
                onSelect: (item) => {
                    this.selectedSource = item.value;
                    this.saveSettings();
                    Lampa.Noty.show('Source set to ' + item.value);
                }
            });
        },

        manualUrlInput: function() {
            const keyboard = new Lampa.Keyboard({
                layout: 'full'
            });
            
            keyboard.create();
            keyboard.set('Enter subtitle URL');
            
            keyboard.on('submit', (value) => {
                keyboard.destroy();
                
                if (value) {
                    this.loadSubtitlesFromUrl(value);
                }
            });
            
            keyboard.on('cancel', () => {
                keyboard.destroy();
            });
        },

        loadSubtitlesFromUrl: function(url) {
            Lampa.Noty.show('Loading subtitles from URL...');
            
            this.fetchSubtitles(url)
                .then(srtText => {
                    if (srtText) {
                        this.applySubtitles(srtText, 'Manual URL');
                        Lampa.Noty.show('Subtitles loaded successfully');
                    } else {
                        throw new Error('Empty subtitle content');
                    }
                })
                .catch(error => {
                    console.error('[SubtitlesSync] URL load error:', error);
                    Lampa.Noty.show('Failed to load subtitles: ' + error.message);
                });
        },

        async loadSubtitlesDirect(title, year) {
            Lampa.Noty.show('Searching for subtitles...');
            
            // Clean title - remove special characters and extra spaces
            const cleanTitle = title.replace(/[^\w\s]/gi, '')
                .replace(/\s+/g, '-')
                .toLowerCase();
                
            // Build different URL patterns based on source
            let subtitlesUrl;
            
            if (this.selectedSource === 'Subadub') {
                subtitlesUrl = `${this.sources.Subadub}/subtitles/${cleanTitle}-${this.selectedLang}.srt`;
            } else if (this.selectedSource === 'OpenSubtitles') {
                subtitlesUrl = `${this.sources.OpenSubtitles}/download/subtitle/${cleanTitle}/${this.selectedLang}`;
            } else if (this.selectedSource === 'Subscene') {
                subtitlesUrl = `${this.sources.Subscene}/subtitles/${cleanTitle}/${this.selectedLang}`;
            } else { // Default to My-Subs
                subtitlesUrl = `${this.sources['My-Subs']}/subtitles/${cleanTitle}${year ? '-' + year : ''}-${this.selectedLang}.srt`;
            }

            // Try with first URL pattern
            try {
                const srtText = await this.fetchSubtitles(subtitlesUrl);
                if (srtText && srtText.trim()) {
                    this.applySubtitles(srtText, this.selectedSource);
                    Lampa.Noty.show('Subtitles loaded successfully');
                    return;
                }
            } catch (e) {
                console.warn('[SubtitlesSync] First attempt failed:', e);
                // Continue to alternative methods
            }

            // Try alternative URL format (using dash instead of hyphen, etc)
            try {
                const altTitle = cleanTitle.replace(/-/g, '_');
                let altUrl;
                
                if (this.selectedSource === 'Subadub') {
                    altUrl = `${this.sources.Subadub}/subs/${altTitle}_${this.selectedLang}.srt`;
                } else {
                    altUrl = `${this.sources['My-Subs']}/subs/${altTitle}${year ? '_' + year : ''}_${this.selectedLang}.srt`;
                }
                
                const srtText = await this.fetchSubtitles(altUrl);
                if (srtText && srtText.trim()) {
                    this.applySubtitles(srtText, this.selectedSource);
                    Lampa.Noty.show('Subtitles loaded successfully');
                    return;
                }
            } catch (e) {
                console.warn('[SubtitlesSync] Alternative attempt failed:', e);
            }

            // Final fallback - try with IMDb search if available
            try {
                if (Lampa.Storage.field('imdb_id')) {
                    const imdbId = Lampa.Storage.field('imdb_id');
                    const imdbUrl = `${this.sources['OpenSubtitles']}/imdbid-${imdbId}/${this.selectedLang}.srt`;
                    
                    const srtText = await this.fetchSubtitles(imdbUrl);
                    if (srtText && srtText.trim()) {
                        this.applySubtitles(srtText, 'IMDb ID');
                        Lampa.Noty.show('Subtitles loaded via IMDb ID');
                        return;
                    }
                }
            } catch (e) {
                console.warn('[SubtitlesSync] IMDb attempt failed:', e);
            }

            Lampa.Noty.show('Could not find subtitles for this video');
        },

        async fetchSubtitles(url) {
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain,application/octet-stream,text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            };

            let finalUrl = url;
            
            // Add proxy if enabled
            if (this.useProxy) {
                finalUrl = this.cors_proxy + url;
            }
            
            try {
                const response = await fetch(finalUrl, fetchOptions);
                
                if (!response.ok) {
                    // If primary proxy fails, try alternative proxy
                    if (this.useProxy) {
                        finalUrl = this.alternative_proxy + encodeURIComponent(url);
                        const altResponse = await fetch(finalUrl, fetchOptions);
                        
                        if (!altResponse.ok) {
                            throw new Error(`HTTP error ${altResponse.status}`);
                        }
                        
                        return await altResponse.text();
                    } else {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                }
                
                return await response.text();
            } catch (error) {
                console.error('[SubtitlesSync] Fetch error:', error);
                
                // If direct access fails and proxy wasn't used, try with proxy
                if (!this.useProxy) {
                    this.useProxy = true;
                    return await this.fetchSubtitles(url);
                }
                
                throw error;
            }
        },

        applySubtitles: function (srtText, source = '') {
            try {
                const player = Lampa.Player;
                const label = `${this.selectedLang.toUpperCase()}${source ? ' - ' + source : ''}`;
                
                // Check if SRT is valid by parsing it
                const parsedSubs = this.parseSRT(srtText);
                
                if (!parsedSubs || parsedSubs.length === 0) {
                    throw new Error('Invalid subtitle format');
                }
                
                // Remove any existing subtitles with the same label
                if (player.subtitles && player.subtitles.container) {
                    const existing = player.subtitles.container.find((sub) => sub.label === label);
                    if (existing) {
                        player.subtitles.container = player.subtitles.container.filter((sub) => sub.label !== label);
                    }
                }
                
                // Add new subtitles
                player.subtitles.add({
                    label: label,
                    url: null, // No URL needed as we provide the content directly
                    index: 0,
                    ready: true,
                    content: parsedSubs
                });
                
                // Activate the newly added subtitles
                const subIndex = player.subtitles.container.length - 1;
                
                if (player.subtitles.select) {
                    player.subtitles.select(subIndex);
                } else if (player.subtitles.show) {
                    player.subtitles.show(subIndex);
                }
            } catch (e) {
                console.error('[SubtitlesSync] Apply subtitles error:', e);
                Lampa.Noty.show('Failed to apply subtitles: ' + e.message);
            }
        },

        parseSRT: function (srtText) {
            if (!srtText || typeof srtText !== 'string') {
                return [];
            }
            
            // Handle both CRLF and LF line endings
            const lines = srtText.replace(/\r\n/g, '\n').split('\n');
            const subtitles = [];
            let currentSub = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Skip empty lines
                if (!line) continue;
                
                // New subtitle entry starts with a number
                if (!isNaN(parseInt(line)) && currentSub === null) {
                    currentSub = { id: parseInt(line) };
                }
                // Time codes line with arrow
                else if (line.includes('-->') && currentSub && !currentSub.start) {
                    try {
                        const [startTime, endTime] = line.split('-->').map(t => t.trim());
                        currentSub.start = this.timeToSeconds(startTime);
                        currentSub.end = this.timeToSeconds(endTime);
                        currentSub.text = '';
                    } catch (e) {
                        console.warn('[SubtitlesSync] Time parsing error:', e);
                    }
                }
                // Text content of subtitle
                else if (currentSub && currentSub.start !== undefined) {
                    if (currentSub.text) {
                        currentSub.text += '\n' + line;
                    } else {
                        currentSub.text = line;
                    }
                }
                
                // If next line is empty or end of file, push the current subtitle
                const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
                if (currentSub && currentSub.text && (!nextLine || !isNaN(parseInt(nextLine)))) {
                    subtitles.push(currentSub);
                    currentSub = null;
                }
            }
            
            // Handle any remaining subtitle
            if (currentSub && currentSub.text) {
                subtitles.push(currentSub);
            }
            
            return subtitles;
        },

        timeToSeconds: function (timeString) {
            try {
                // Handle both comma and dot as decimal separator
                const time = timeString.replace(',', '.');
                const [timeWithoutMs, ms] = time.includes('.') ? time.split('.') : [time, '0'];
                const [hours, minutes, seconds] = timeWithoutMs.split(':').map(Number);
                
                return hours * 3600 + minutes * 60 + seconds + parseFloat(`0.${ms}`);
            } catch (e) {
                console.error('[SubtitlesSync] Time parsing error:', timeString, e);
                return 0;
            }
        },

        // Retry mechanism for all operations
        retry: async function(operation, maxAttempts = 3) {
            let lastError;
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await operation();
                } catch (error) {
                    console.warn(`[SubtitlesSync] Attempt ${attempt}/${maxAttempts} failed:`, error);
                    lastError = error;
                    
                    // Wait before retrying (exponential backoff)
                    if (attempt < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }
            
            throw lastError;
        }
    };

    // Initialize when Lampa is fully loaded
    waitForLampa(() => {
        try {
            SubtitlesSync.init();
            
            // Register plugin globally
            window.Lampa = window.Lampa || {};
            window.Lampa.Plugins = window.Lampa.Plugins || {};
            window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
            
            console.log('[SubtitlesSync] Plugin registered successfully');
        } catch (e) {
            console.error('[SubtitlesSync] Initialization error:', e);
            
            // Try to show error message if Noty is available
            if (window.Lampa && window.Lampa.Noty) {
                Lampa.Noty.show('Subtitles Sync: ' + e.message);
            }
        }
    });
})();
