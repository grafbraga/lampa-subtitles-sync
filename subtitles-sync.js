// ==LampaPlugin==
// Name: Subtitles Sync Enhanced
// Description: Advanced plugin for loading subtitles with proper CORS handling
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
        } else if (attempts < 20) {
            setTimeout(() => waitForLampa(callback, attempts + 1), 500);
        } else {
            console.error('[SubtitlesSync] Lampa environment not found after multiple attempts');
        }
    }

    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '3.0.0',
        
        // Use public CORS proxies that should work with Lampa
        corsProxies: [
            'https://corsproxy.io/?',
            'https://proxy.cors.sh/',
            'https://api.allorigins.win/raw?url='
        ],
        currentProxyIndex: 0,
        
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co',
            'OpenSubtitles': 'https://opensubtitles.com'
        },
        defaultSource: 'My-Subs',
        languages: ['en', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'zh'],
        selectedLang: 'en',
        selectedSource: 'My-Subs',
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
                this.currentProxyIndex = savedSettings.proxyIndex || 0;
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
                    proxyIndex: this.currentProxyIndex
                });
            } catch (e) {
                console.error('[SubtitlesSync] Settings save error:', e);
            }
        },

        addSettings: function () {
            // Create settings object with language and source options
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
                change_proxy: {
                    name: 'Change CORS Proxy',
                    type: 'button',
                    onClick: () => {
                        this.cycleProxy();
                        Lampa.Noty.show('CORS proxy changed');
                    }
                }
            };

            // Try to use the newer Settings.inject method first
            try {
                if (typeof Lampa.Settings.inject === 'function') {
                    Lampa.Settings.inject(this.name, settingsObject);
                } else {
                    Lampa.Settings.add(this.name, settingsObject);
                }
            } catch (e) {
                // Fallback to older method
                console.warn('[SubtitlesSync] Falling back to add method:', e);
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
            } else if (Lampa.PlayerMenu && typeof Lampa.PlayerMenu.create === 'function') {
                // Alternative method for older Lampa versions
                const playerMenuItems = Lampa.PlayerMenu.create().find(m => m.id === 'settings');
                if (playerMenuItems && playerMenuItems.items) {
                    playerMenuItems.items.push({
                        title: 'Subtitles Sync',
                        subtitle: 'Load subtitles for current video',
                        id: 'subtitles_sync',
                        action: () => this.showSubtitlesMenu()
                    });
                }
            }

            // Add to main menu for settings
            try {
                // Try the modern approach first
                if (Lampa.Menu && typeof Lampa.Menu.append === 'function') {
                    Lampa.Menu.append({
                        id: 'subtitles_sync_menu',
                        title: 'Subtitles Sync',
                        icon: 'subtitles',
                        order: 105,
                        create: () => {
                            return [{
                                title: 'Subtitles Settings',
                                subtitle: 'Configure subtitles source and language',
                                icon: 'settings',
                                action: () => {
                                    if (typeof Lampa.Settings.open === 'function') {
                                        Lampa.Settings.open('SubtitlesSync');
                                    } else {
                                        Lampa.Settings.show('SubtitlesSync');
                                    }
                                }
                            }];
                        }
                    });
                } else if (Lampa.Menu && typeof Lampa.Menu.added === 'function') {
                    // Check if it's already added to avoid duplicates
                    if (!Lampa.Menu.added('subtitles_sync_menu')) {
                        Lampa.Menu.set('subtitles_sync_menu', {
                            title: 'Subtitles Sync',
                            icon: 'subtitles',
                            order: 105
                        });
                    }
                }
            } catch (e) {
                console.warn('[SubtitlesSync] Menu integration error:', e);
                // Simple fallback for older versions
                if (Lampa.Menu && typeof Lampa.Menu.add === 'function') {
                    Lampa.Menu.add({
                        title: 'Subtitles Sync Settings',
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
        },

        attachPlayerEvents: function () {
            try {
                Lampa.Listener.follow('player', (event) => {
                    if (event.type === 'start') {
                        // Add button to player controls if possible
                        setTimeout(() => {
                            if (Lampa.Player && Lampa.Player.subtitles && !Lampa.Player.subtitles.hasOwnProperty('_subtitlesSyncButton')) {
                                this.addButtonToPlayer();
                            }
                        }, 2000);
                    }
                });
            } catch (e) {
                console.error('[SubtitlesSync] Player event attachment failed:', e);
            }
        },

        addButtonToPlayer: function() {
            try {
                // Mark that we've attempted to add the button
                Lampa.Player.subtitles._subtitlesSyncButton = true;
                
                // Add a button to the subtitle menu if it exists
                if (Lampa.Player.subtitles.button && Lampa.Player.subtitles.button.addClass) {
                    const subButton = Lampa.Player.subtitles.button;
                    subButton.addClass('subtitles-sync-enabled');
                    
                    // Add a click handler to open our menu
                    const originalClick = subButton.on || subButton.click;
                    subButton.on = subButton.click = function(e) {
                        if (e && e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            SubtitlesSync.showSubtitlesMenu();
                            return false;
                        } else if (typeof originalClick === 'function') {
                            return originalClick.apply(this, arguments);
                        }
                    };
                }
            } catch (e) {
                console.error('[SubtitlesSync] Failed to add button to player:', e);
            }
        },

        cycleProxy: function() {
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.corsProxies.length;
            this.saveSettings();
        },

        getCurrentProxy: function() {
            return this.corsProxies[this.currentProxyIndex];
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

            // Create a simple menu for the user
            Lampa.Select.show({
                title: 'Subtitles for: ' + title,
                items: [
                    { title: 'Search Online', subtitle: 'From ' + this.selectedSource, value: 'search' },
                    { title: 'Manual URL', subtitle: 'Paste direct subtitle link', value: 'manual' },
                    { title: 'Change Language', subtitle: 'Current: ' + this.selectedLang.toUpperCase(), value: 'language' },
                    { title: 'Change Source', subtitle: 'Current: ' + this.selectedSource, value: 'source' },
                    { title: 'Change Proxy', subtitle: 'If having connection issues', value: 'proxy' }
                ],
                onSelect: (item) => {
                    if (item.value === 'search') this.loadSubtitlesDirect(title, year);
                    else if (item.value === 'manual') this.manualUrlInput();
                    else if (item.value === 'language') this.showLanguageSelector();
                    else if (item.value === 'source') this.showSourceSelector();
                    else if (item.value === 'proxy') {
                        this.cycleProxy();
                        Lampa.Noty.show('CORS proxy changed. Try loading subtitles again.');
                    }
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
                    Lampa.Noty.show('Failed to load subtitles. Try changing proxy in settings');
                });
        },

        async loadSubtitlesDirect(title, year) {
            Lampa.Noty.show('Searching for subtitles...');
            
            // Clean the title for URL safety
            const cleanTitle = title.replace(/[^\w\s]/gi, '')
                .replace(/\s+/g, '-')
                .toLowerCase();
                
            // Create URLs for different services
            let urlsToTry = [];
            
            if (this.selectedSource === 'Subadub') {
                urlsToTry = [
                    `${this.sources.Subadub}/subtitles/${cleanTitle}-${this.selectedLang}.srt`,
                    `${this.sources.Subadub}/subs/${cleanTitle}_${this.selectedLang}.srt`
                ];
            } else if (this.selectedSource === 'My-Subs') {
                urlsToTry = [
                    `${this.sources['My-Subs']}/subtitles/${cleanTitle}${year ? '-' + year : ''}-${this.selectedLang}.srt`,
                    `${this.sources['My-Subs']}/subs/${cleanTitle}${year ? '_' + year : ''}_${this.selectedLang}.srt`
                ];
            } else {
                // Generic patterns for other sources
                urlsToTry = [
                    `${this.sources[this.selectedSource]}/subtitle/${cleanTitle}-${this.selectedLang}.srt`,
                    `${this.sources[this.selectedSource]}/subs/${cleanTitle}-${this.selectedLang}.srt`
                ];
            }
            
            // Try all potential URLs in sequence
            for (const url of urlsToTry) {
                try {
                    console.log('[SubtitlesSync] Trying URL:', url);
                    const srtText = await this.fetchSubtitles(url);
                    
                    if (srtText && srtText.trim() && this.isValidSRT(srtText)) {
                        this.applySubtitles(srtText, this.selectedSource);
                        Lampa.Noty.show('Subtitles loaded successfully');
                        return;
                    }
                } catch (e) {
                    console.warn('[SubtitlesSync] Failed with URL:', url, e);
                    // Continue to next URL
                }
            }
            
            // Try one more time with a different proxy if all attempts failed
            this.cycleProxy();
            
            try {
                const lastUrl = urlsToTry[0]; // Try first URL again with new proxy
                const srtText = await this.fetchSubtitles(lastUrl);
                
                if (srtText && srtText.trim() && this.isValidSRT(srtText)) {
                    this.applySubtitles(srtText, this.selectedSource);
                    Lampa.Noty.show('Subtitles loaded successfully with alternative proxy');
                    return;
                }
            } catch (e) {
                console.warn('[SubtitlesSync] Final attempt failed:', e);
            }
            
            Lampa.Noty.show('Could not find subtitles for this video');
        },

        isValidSRT: function(text) {
            // Basic validation to check if the content looks like a subtitle file
            return text.includes('-->') && /\d+:\d+:\d+/.test(text);
        },

        async fetchSubtitles(url) {
            // Get the current CORS proxy
            const proxy = this.getCurrentProxy();
            const proxyUrl = proxy + encodeURIComponent(url);
            
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain,application/octet-stream,text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                mode: 'cors',
                cache: 'no-cache'
            };
            
            console.log('[SubtitlesSync] Fetching with proxy:', proxyUrl);
            
            try {
                const response = await fetch(proxyUrl, fetchOptions);
                
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                return await response.text();
            } catch (error) {
                console.error('[SubtitlesSync] Fetch error:', error);
                throw error;
            }
        },

        applySubtitles: function (srtText, source = '') {
            try {
                const player = Lampa.Player;
                const label = `${this.selectedLang.toUpperCase()}${source ? ' - ' + source : ''}`;
                
                // Parse SRT content
                const parsedSubs = this.parseSRT(srtText);
                
                if (!parsedSubs || parsedSubs.length === 0) {
                    throw new Error('Invalid subtitle format');
                }
                
                // Add subtitles to player
                // Check which API version is available
                if (player.subtitles && typeof player.subtitles.add === 'function') {
                    player.subtitles.add({
                        label: label,
                        url: null, // No URL needed as we provide parsed content
                        index: 0,
                        ready: true,
                        content: parsedSubs
                    });
                    
                    // Activate the newly added subtitles
                    if (typeof player.subtitles.select === 'function') {
                        player.subtitles.select(player.subtitles.container.length - 1);
                    }
                } else {
                    // Fallback for older Lampa versions
                    if (!player.subtitle) {
                        player.subtitle = {
                            container: []
                        };
                    }
                    
                    player.subtitle.container.push({
                        label: label,
                        url: null,
                        ready: true,
                        content: parsedSubs
                    });
                    
                    if (typeof player.changeSubtitle === 'function') {
                        player.changeSubtitle(player.subtitle.container.length - 1);
                    }
                }
            } catch (e) {
                console.error('[SubtitlesSync] Apply subtitles error:', e);
                Lampa.Noty.show('Failed to apply subtitles');
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
                if (/^\d+$/.test(line) && currentSub === null) {
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
                
                // Check if we need to save the current subtitle and start a new one
                if (currentSub && currentSub.text && i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    if (!nextLine || /^\d+$/.test(nextLine)) {
                        subtitles.push(currentSub);
                        currentSub = null;
                    }
                }
            }
            
            // Don't forget the last subtitle if we have one
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
                Lampa.Noty.show('Subtitles Sync initialization error');
            }
        }
    });
})();
