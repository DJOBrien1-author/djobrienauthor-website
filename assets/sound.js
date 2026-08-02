/**
 * Dark Lair Trilogy ambient sound engine, version 1.9.
 * Final sound release with generated ambience, scroll effects, battle effects, forest ambience, and separate volume controls.
 * Uses the Web Audio API, so no external audio files are required.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'dltSoundSettingsV1';
  const DEFAULTS = Object.freeze({
    enabled: true,
    masterVolume: 0.24,
    ambienceVolume: 0.72,
    effectsVolume: 0.82
  });

  const clamp = (value, minimum = 0, maximum = 1) =>
    Math.min(maximum, Math.max(minimum, Number(value) || 0));

  function loadSettings() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
        masterVolume: clamp(saved.masterVolume ?? DEFAULTS.masterVolume),
        ambienceVolume: clamp(saved.ambienceVolume ?? DEFAULTS.ambienceVolume),
        effectsVolume: clamp(saved.effectsVolume ?? DEFAULTS.effectsVolume)
      };
    } catch (error) {
      console.warn('[DLT Sound] Saved settings could not be read.', error);
      return { ...DEFAULTS };
    }
  }

  class DarkLairSoundEngine extends EventTarget {
    constructor() {
      super();
      this.settings = loadSettings();
      this.context = null;
      this.masterGain = null;
      this.ambienceGain = null;
      this.effectsGain = null;
      this.activeAmbience = new Map();
      this.activeEffects = new Set();
      this.unlocked = false;
      this._boundUnlock = this.unlock.bind(this);
      this.scrollObserver = null;
      this.scrollEffectTimers = new WeakMap();
      this.lastScrollEffectAt = 0;
      this.battleObserver = null;
      this.lastBattleEffectAt = 0;
      this.forestEventTimer = null;
    }

    initialise() {
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, this._boundUnlock, { once: true, passive: true });
      });
      this.dispatchEvent(new CustomEvent('ready', { detail: this.getState() }));
      return this;
    }

    async unlock() {
      this._ensureContext();
      if (this.context && this.context.state === 'suspended') {
        try {
          await this.context.resume();
        } catch (error) {
          console.warn('[DLT Sound] Browser audio could not be resumed.', error);
        }
      }
      this.unlocked = Boolean(this.context && this.context.state === 'running');
      this._applyVolumes(0.08);
      this.dispatchEvent(new CustomEvent('unlock', { detail: this.getState() }));
      if (this.unlocked && this.settings.enabled) this.startPageAmbience();
      return this.unlocked;
    }

    _ensureContext() {
      if (this.context) return this.context;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[DLT Sound] Web Audio API is not supported in this browser.');
        return null;
      }
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.ambienceGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.ambienceGain.connect(this.masterGain);
      this.effectsGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      this._applyVolumes(0);
      return this.context;
    }

    _ramp(gainNode, value, duration = 0.18) {
      if (!this.context || !gainNode) return;
      const now = this.context.currentTime;
      const end = now + Math.max(0.01, Number(duration) || 0.01);
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(clamp(value), end);
    }

    _applyVolumes(duration = 0.18) {
      if (!this.context) return;
      this._ramp(this.masterGain, this.settings.enabled ? this.settings.masterVolume : 0, duration);
      this._ramp(this.ambienceGain, this.settings.ambienceVolume, duration);
      this._ramp(this.effectsGain, this.settings.effectsVolume, duration);
    }

    _save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (error) {
        console.warn('[DLT Sound] Settings could not be saved.', error);
      }
      this.dispatchEvent(new CustomEvent('change', { detail: this.getState() }));
    }

    setEnabled(enabled) {
      this.settings.enabled = Boolean(enabled);
      this._ensureContext();
      this._applyVolumes(0.28);
      this._save();
      if (this.settings.enabled && this.unlocked) this.startPageAmbience();
      if (!this.settings.enabled) this.stopAll(0.28);
      return this.settings.enabled;
    }

    toggle() {
      return this.setEnabled(!this.settings.enabled);
    }

    setMasterVolume(value) {
      this.settings.masterVolume = clamp(value);
      this._applyVolumes(0.08);
      this._save();
      return this.settings.masterVolume;
    }

    setAmbienceVolume(value) {
      this.settings.ambienceVolume = clamp(value);
      this._applyVolumes(0.08);
      this._save();
      return this.settings.ambienceVolume;
    }

    setEffectsVolume(value) {
      this.settings.effectsVolume = clamp(value);
      this._applyVolumes(0.08);
      this._save();
      return this.settings.effectsVolume;
    }

    getState() {
      return {
        ...this.settings,
        unlocked: this.unlocked,
        contextState: this.context ? this.context.state : 'not-created',
        activeAmbience: Array.from(this.activeAmbience.keys()),
        activeEffectCount: this.activeEffects.size
      };
    }

    getBus(type = 'effects') {
      this._ensureContext();
      return type === 'ambience' ? this.ambienceGain : this.effectsGain;
    }


    _createNoiseBuffer(seconds = 4) {
      if (!this.context) return null;
      const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const channel = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < length; index += 1) {
        const white = (Math.random() * 2) - 1;
        last = (last * 0.985) + (white * 0.015);
        channel[index] = last * 3.2;
      }
      return buffer;
    }

    startHomeAmbience() {
      if (!this.settings.enabled || this.activeAmbience.has('home')) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const groupGain = this.context.createGain();
      groupGain.gain.setValueAtTime(0, now);
      groupGain.connect(this.ambienceGain);

      const windSource = this.context.createBufferSource();
      windSource.buffer = this._createNoiseBuffer(5);
      windSource.loop = true;

      const windFilter = this.context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(620, now);
      windFilter.Q.setValueAtTime(0.45, now);

      const windGain = this.context.createGain();
      windGain.gain.setValueAtTime(0.16, now);
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(groupGain);

      const windLfo = this.context.createOscillator();
      const windLfoGain = this.context.createGain();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.075, now);
      windLfoGain.gain.setValueAtTime(0.055, now);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windGain.gain);

      const humGain = this.context.createGain();
      humGain.gain.setValueAtTime(0.012, now);
      humGain.connect(groupGain);

      const humOne = this.context.createOscillator();
      humOne.type = 'sine';
      humOne.frequency.setValueAtTime(54, now);
      humOne.connect(humGain);

      const humTwo = this.context.createOscillator();
      humTwo.type = 'sine';
      humTwo.frequency.setValueAtTime(81, now);
      const humTwoGain = this.context.createGain();
      humTwoGain.gain.setValueAtTime(0.42, now);
      humTwo.connect(humTwoGain);
      humTwoGain.connect(humGain);

      const shimmer = this.context.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(216, now);
      const shimmerGain = this.context.createGain();
      shimmerGain.gain.setValueAtTime(0.0015, now);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(groupGain);

      const nodes = [windSource, windLfo, humOne, humTwo, shimmer];
      nodes.forEach((node) => node.start(now));
      groupGain.gain.linearRampToValueAtTime(1, now + 1.8);

      this.activeAmbience.set('home', {
        gain: groupGain,
        source: windSource,
        sources: nodes
      });
      this.dispatchEvent(new CustomEvent('ambiencestart', { detail: { name: 'home' } }));
      return true;
    }


    startArchiveAmbience() {
      if (!this.settings.enabled || this.activeAmbience.has('archive')) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const groupGain = this.context.createGain();
      groupGain.gain.setValueAtTime(0, now);
      groupGain.connect(this.ambienceGain);

      const windSource = this.context.createBufferSource();
      windSource.buffer = this._createNoiseBuffer(6);
      windSource.loop = true;

      const windFilter = this.context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(430, now);
      windFilter.Q.setValueAtTime(0.7, now);

      const windGain = this.context.createGain();
      windGain.gain.setValueAtTime(0.105, now);
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(groupGain);

      const windLfo = this.context.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.055, now);

      const windLfoGain = this.context.createGain();
      windLfoGain.gain.setValueAtTime(0.038, now);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windGain.gain);

      const fireSource = this.context.createBufferSource();
      fireSource.buffer = this._createNoiseBuffer(3);
      fireSource.loop = true;

      const fireFilter = this.context.createBiquadFilter();
      fireFilter.type = 'bandpass';
      fireFilter.frequency.setValueAtTime(1180, now);
      fireFilter.Q.setValueAtTime(0.85, now);

      const fireGain = this.context.createGain();
      fireGain.gain.setValueAtTime(0.045, now);
      fireSource.connect(fireFilter);
      fireFilter.connect(fireGain);
      fireGain.connect(groupGain);

      const fireLfo = this.context.createOscillator();
      fireLfo.type = 'triangle';
      fireLfo.frequency.setValueAtTime(1.7, now);

      const fireLfoGain = this.context.createGain();
      fireLfoGain.gain.setValueAtTime(0.018, now);
      fireLfo.connect(fireLfoGain);
      fireLfoGain.connect(fireGain.gain);

      const roomGain = this.context.createGain();
      roomGain.gain.setValueAtTime(0.0075, now);
      roomGain.connect(groupGain);

      const roomTone = this.context.createOscillator();
      roomTone.type = 'sine';
      roomTone.frequency.setValueAtTime(48, now);
      roomTone.connect(roomGain);

      const roomOvertone = this.context.createOscillator();
      roomOvertone.type = 'sine';
      roomOvertone.frequency.setValueAtTime(72, now);

      const overtoneGain = this.context.createGain();
      overtoneGain.gain.setValueAtTime(0.35, now);
      roomOvertone.connect(overtoneGain);
      overtoneGain.connect(roomGain);

      const nodes = [
        windSource,
        windLfo,
        fireSource,
        fireLfo,
        roomTone,
        roomOvertone
      ];

      nodes.forEach((node) => node.start(now));
      groupGain.gain.linearRampToValueAtTime(1, now + 1.35);

      this.activeAmbience.set('archive', {
        gain: groupGain,
        source: windSource,
        sources: nodes
      });

      this.dispatchEvent(new CustomEvent('ambiencestart', {
        detail: { name: 'archive' }
      }));

      return true;
    }

    stopAmbience(name, fadeSeconds = 0.7) {
      const entry = this.activeAmbience.get(name);
      if (!entry || !this.context) return false;
      const stopAt = this.context.currentTime + Math.max(0.05, fadeSeconds);
      this._ramp(entry.gain, 0, fadeSeconds);
      const sources = entry.sources || [entry.source];
      sources.filter(Boolean).forEach((source) => {
        try { source.stop(stopAt); } catch (_) { /* already stopped */ }
      });
      this.activeAmbience.delete(name);
      this.dispatchEvent(new CustomEvent('ambiencestop', { detail: { name } }));
      return true;
    }


    playParchmentRustle(intensity = 1) {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const duration = 0.55;
      const source = this.context.createBufferSource();
      source.buffer = this._createNoiseBuffer(duration);

      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, now);
      filter.Q.setValueAtTime(0.7, now);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09 * Math.max(0.35, intensity), now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.effectsGain);

      source.start(now);
      source.stop(now + duration + 0.05);
      this.activeEffects.add({ source, gain });

      source.addEventListener('ended', () => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === source) this.activeEffects.delete(entry);
        });
      }, { once: true });

      return true;
    }

    playQuillScratch() {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const duration = 0.9;
      const source = this.context.createBufferSource();
      source.buffer = this._createNoiseBuffer(duration);

      const highpass = this.context.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(1900, now);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.027, now + 0.06);
      gain.gain.setValueAtTime(0.02, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(highpass);
      highpass.connect(gain);
      gain.connect(this.effectsGain);

      source.start(now);
      source.stop(now + duration + 0.05);
      this.activeEffects.add({ source, gain });

      source.addEventListener('ended', () => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === source) this.activeEffects.delete(entry);
        });
      }, { once: true });

      return true;
    }

    initialiseScrollEffects() {
      const page = document.body ? document.body.dataset.page : '';
      if (page !== 'archive' && page !== 'archives') return false;
      if (!('IntersectionObserver' in window)) return false;

      const selectors = [
        '.archive-entry',
        '.archive-card',
        '.manuscript',
        '.scroll',
        '[data-archive-entry]',
        'article'
      ];

      const targets = Array.from(document.querySelectorAll(selectors.join(',')))
        .filter((element, index, collection) => collection.indexOf(element) === index);

      if (!targets.length) return false;

      this.scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;

          const now = Date.now();
          if (now - this.lastScrollEffectAt < 2600) return;
          this.lastScrollEffectAt = now;

          this.playParchmentRustle(0.75);

          const existingTimer = this.scrollEffectTimers.get(entry.target);
          if (existingTimer) window.clearTimeout(existingTimer);

          const timer = window.setTimeout(() => {
            if (this.settings.enabled) this.playQuillScratch();
          }, 1200 + Math.floor(Math.random() * 900));

          this.scrollEffectTimers.set(entry.target, timer);
          this.scrollObserver.unobserve(entry.target);
        });
      }, {
        threshold: [0.45, 0.65]
      });

      targets.forEach((target) => this.scrollObserver.observe(target));
      return true;
    }


    playSwordClash() {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.065, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      gain.connect(this.effectsGain);

      const strike = this.context.createOscillator();
      strike.type = 'square';
      strike.frequency.setValueAtTime(1250, now);
      strike.frequency.exponentialRampToValueAtTime(310, now + 0.12);
      strike.connect(gain);

      const ringGain = this.context.createGain();
      ringGain.gain.setValueAtTime(0.0001, now);
      ringGain.gain.exponentialRampToValueAtTime(0.022, now + 0.012);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      ringGain.connect(this.effectsGain);

      const ring = this.context.createOscillator();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(2180, now);
      ring.connect(ringGain);

      strike.start(now);
      ring.start(now);
      strike.stop(now + 0.36);
      ring.stop(now + 0.54);

      this.activeEffects.add({ source: strike, gain });
      this.activeEffects.add({ source: ring, gain: ringGain });

      const remove = (source) => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === source) this.activeEffects.delete(entry);
        });
      };
      strike.addEventListener('ended', () => remove(strike), { once: true });
      ring.addEventListener('ended', () => remove(ring), { once: true });

      return true;
    }

    playShieldImpact() {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const source = this.context.createBufferSource();
      source.buffer = this._createNoiseBuffer(0.42);

      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.effectsGain);

      source.start(now);
      source.stop(now + 0.45);

      this.activeEffects.add({ source, gain });
      source.addEventListener('ended', () => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === source) this.activeEffects.delete(entry);
        });
      }, { once: true });

      return true;
    }

    playBattleRumble() {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const duration = 2.4;
      const source = this.context.createBufferSource();
      source.buffer = this._createNoiseBuffer(duration);

      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.026, now + 0.35);
      gain.gain.setValueAtTime(0.021, now + 1.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.effectsGain);

      source.start(now);
      source.stop(now + duration + 0.05);

      this.activeEffects.add({ source, gain });
      source.addEventListener('ended', () => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === source) this.activeEffects.delete(entry);
        });
      }, { once: true });

      return true;
    }

    playBattleSequence() {
      if (!this.settings.enabled || !this.unlocked) return false;

      this.playBattleRumble();

      window.setTimeout(() => {
        if (this.settings.enabled) this.playSwordClash();
      }, 380);

      window.setTimeout(() => {
        if (this.settings.enabled) this.playShieldImpact();
      }, 980);

      window.setTimeout(() => {
        if (this.settings.enabled && Math.random() > 0.35) this.playSwordClash();
      }, 1550);

      return true;
    }

    initialiseBattleEffects() {
      if (!('IntersectionObserver' in window)) return false;

      const keywords = [
        'war',
        'battle',
        'siege',
        'army',
        'armies',
        'horde',
        'soldier',
        'soldiers',
        'fighting',
        'combat'
      ];

      const candidates = Array.from(document.querySelectorAll(
        'main section, main article, .archive-entry, .archive-card, .manuscript, .scroll, [data-battle-scene]'
      ));

      const targets = candidates.filter((element) => {
        if (element.hasAttribute('data-battle-scene')) return true;
        const text = (element.textContent || '').toLowerCase();
        return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(text));
      });

      if (!targets.length) return false;

      this.battleObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;

          const now = Date.now();
          if (now - this.lastBattleEffectAt < 9000) return;
          this.lastBattleEffectAt = now;

          this.playBattleSequence();
          this.battleObserver.unobserve(entry.target);
        });
      }, {
        threshold: [0.5, 0.7]
      });

      targets.forEach((target) => this.battleObserver.observe(target));
      return true;
    }


    startWorldAmbience() {
      if (!this.settings.enabled || this.activeAmbience.has('world')) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const groupGain = this.context.createGain();
      groupGain.gain.setValueAtTime(0, now);
      groupGain.connect(this.ambienceGain);

      // Broad woodland wind.
      const windSource = this.context.createBufferSource();
      windSource.buffer = this._createNoiseBuffer(7);
      windSource.loop = true;

      const windFilter = this.context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(760, now);
      windFilter.Q.setValueAtTime(0.35, now);

      const windGain = this.context.createGain();
      windGain.gain.setValueAtTime(0.095, now);
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(groupGain);

      const windLfo = this.context.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.09, now);

      const windLfoGain = this.context.createGain();
      windLfoGain.gain.setValueAtTime(0.03, now);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windGain.gain);

      // Leaf rustle.
      const leavesSource = this.context.createBufferSource();
      leavesSource.buffer = this._createNoiseBuffer(4);
      leavesSource.loop = true;

      const leavesFilter = this.context.createBiquadFilter();
      leavesFilter.type = 'highpass';
      leavesFilter.frequency.setValueAtTime(1850, now);

      const leavesGain = this.context.createGain();
      leavesGain.gain.setValueAtTime(0.018, now);
      leavesSource.connect(leavesFilter);
      leavesFilter.connect(leavesGain);
      leavesGain.connect(groupGain);

      const leavesLfo = this.context.createOscillator();
      leavesLfo.type = 'triangle';
      leavesLfo.frequency.setValueAtTime(0.42, now);

      const leavesLfoGain = this.context.createGain();
      leavesLfoGain.gain.setValueAtTime(0.009, now);
      leavesLfo.connect(leavesLfoGain);
      leavesLfoGain.connect(leavesGain.gain);

      // Very low natural resonance.
      const earthGain = this.context.createGain();
      earthGain.gain.setValueAtTime(0.0045, now);
      earthGain.connect(groupGain);

      const earthTone = this.context.createOscillator();
      earthTone.type = 'sine';
      earthTone.frequency.setValueAtTime(42, now);
      earthTone.connect(earthGain);

      const nodes = [
        windSource,
        windLfo,
        leavesSource,
        leavesLfo,
        earthTone
      ];

      nodes.forEach((node) => node.start(now));
      groupGain.gain.linearRampToValueAtTime(1, now + 1.5);

      this.activeAmbience.set('world', {
        gain: groupGain,
        source: windSource,
        sources: nodes
      });

      this.scheduleForestEvent();

      this.dispatchEvent(new CustomEvent('ambiencestart', {
        detail: { name: 'world' }
      }));

      return true;
    }

    playRavenCall() {
      if (!this.settings.enabled || !this.unlocked) return false;
      this._ensureContext();
      if (!this.context || this.context.state !== 'running') return false;

      const now = this.context.currentTime;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.026, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      gain.connect(this.effectsGain);

      const call = this.context.createOscillator();
      call.type = 'sawtooth';
      call.frequency.setValueAtTime(520, now);
      call.frequency.exponentialRampToValueAtTime(240, now + 0.32);
      call.frequency.exponentialRampToValueAtTime(330, now + 0.56);
      call.frequency.exponentialRampToValueAtTime(205, now + 0.86);
      call.connect(gain);

      call.start(now);
      call.stop(now + 0.95);

      this.activeEffects.add({ source: call, gain });
      call.addEventListener('ended', () => {
        this.activeEffects.forEach((entry) => {
          if (entry.source === call) this.activeEffects.delete(entry);
        });
      }, { once: true });

      return true;
    }

    scheduleForestEvent() {
      if (this.forestEventTimer) window.clearTimeout(this.forestEventTimer);
      if (!this.activeAmbience.has('world')) return false;

      const delay = 5000 + Math.floor(Math.random() * 7000);
      this.forestEventTimer = window.setTimeout(() => {
        if (this.settings.enabled && this.activeAmbience.has('world')) {
          this.playRavenCall();
          this.scheduleForestEvent();
        }
      }, delay);

      return true;
    }

    startPageAmbience() {
      const page = document.body ? document.body.dataset.page : '';
      if (page === 'home') return this.startHomeAmbience();
      if (page === 'archive' || page === 'archives') return this.startArchiveAmbience();
      if (page === 'world') return this.startWorldAmbience();
      return false;
    }

    stopAll(fadeSeconds = 0.35) {
      const stopAt = this.context ? this.context.currentTime + Math.max(0.05, fadeSeconds) : 0;
      this.activeAmbience.forEach((entry) => {
        if (entry.gain && this.context) this._ramp(entry.gain, 0, fadeSeconds);
        const sources = entry.sources || [entry.source];
        sources.filter(Boolean).forEach((source) => {
          try { source.stop(stopAt); } catch (_) { /* already stopped */ }
        });
      });
      this.activeEffects.forEach((entry) => {
        if (entry.gain && this.context) this._ramp(entry.gain, 0, fadeSeconds);
        if (entry.source && this.context) {
          try { entry.source.stop(stopAt); } catch (_) { /* already stopped */ }
        }
      });
      this.activeAmbience.clear();
      this.activeEffects.clear();
      this.dispatchEvent(new CustomEvent('stopall'));
    }
  }



  function createSoundControls(engine) {
    if (!document.body || document.getElementById('dlt-sound-control')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'dlt-sound-control';
    wrapper.className = 'dlt-sound-control';
    wrapper.innerHTML = `
      <button
        class="dlt-sound-crystal"
        type="button"
        aria-label="Open ambient sound controls"
        aria-expanded="false"
        aria-controls="dlt-sound-panel"
        title="Ambient sound controls"
      >
        <span class="dlt-crystal-shape" aria-hidden="true">◆</span>
        <span class="dlt-sound-state" aria-hidden="true"></span>
      </button>
      <section class="dlt-sound-panel" id="dlt-sound-panel" aria-label="Ambient sound controls" hidden>
        <div class="dlt-sound-panel-heading">
          <strong>Ambient Sound</strong>
          <button class="dlt-sound-close" type="button" aria-label="Close sound controls">×</button>
        </div>
        <label class="dlt-sound-switch-row" for="dlt-sound-enabled">
          <span>Sound</span>
          <input id="dlt-sound-enabled" type="checkbox">
        </label>
        <label class="dlt-sound-volume-row" for="dlt-sound-master-volume">
          <span>Master volume</span>
          <output id="dlt-sound-volume-output" for="dlt-sound-master-volume">24%</output>
        </label>
        <input
          id="dlt-sound-master-volume"
          class="dlt-sound-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="24"
          aria-label="Master sound volume"
        >
        <label class="dlt-sound-volume-row" for="dlt-sound-ambience-volume">
          <span>Ambience</span>
          <output id="dlt-sound-ambience-output" for="dlt-sound-ambience-volume">72%</output>
        </label>
        <input
          id="dlt-sound-ambience-volume"
          class="dlt-sound-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="72"
          aria-label="Ambient background volume"
        >
        <label class="dlt-sound-volume-row" for="dlt-sound-effects-volume">
          <span>Effects</span>
          <output id="dlt-sound-effects-output" for="dlt-sound-effects-volume">82%</output>
        </label>
        <input
          id="dlt-sound-effects-volume"
          class="dlt-sound-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="82"
          aria-label="Sound effects volume"
        >
        <p class="dlt-sound-note">Audio begins after your first click or key press when required by the browser.</p>
      </section>`;

    document.body.appendChild(wrapper);

    const crystalButton = wrapper.querySelector('.dlt-sound-crystal');
    const panel = wrapper.querySelector('.dlt-sound-panel');
    const closeButton = wrapper.querySelector('.dlt-sound-close');
    const enabledInput = wrapper.querySelector('#dlt-sound-enabled');
    const volumeInput = wrapper.querySelector('#dlt-sound-master-volume');
    const volumeOutput = wrapper.querySelector('#dlt-sound-volume-output');
    const ambienceInput = wrapper.querySelector('#dlt-sound-ambience-volume');
    const ambienceOutput = wrapper.querySelector('#dlt-sound-ambience-output');
    const effectsInput = wrapper.querySelector('#dlt-sound-effects-volume');
    const effectsOutput = wrapper.querySelector('#dlt-sound-effects-output');

    const update = () => {
      const state = engine.getState();
      enabledInput.checked = state.enabled;
      const percentage = Math.round(state.masterVolume * 100);
      const ambiencePercentage = Math.round(state.ambienceVolume * 100);
      const effectsPercentage = Math.round(state.effectsVolume * 100);

      volumeInput.value = String(percentage);
      volumeOutput.value = `${percentage}%`;
      ambienceInput.value = String(ambiencePercentage);
      ambienceOutput.value = `${ambiencePercentage}%`;
      effectsInput.value = String(effectsPercentage);
      effectsOutput.value = `${effectsPercentage}%`;

      wrapper.classList.toggle('is-enabled', state.enabled && percentage > 0);
      wrapper.classList.toggle('is-muted', !state.enabled || percentage === 0);
      crystalButton.setAttribute(
        'aria-label',
        state.enabled ? 'Open ambient sound controls. Sound is on.' : 'Open ambient sound controls. Sound is off.'
      );
    };

    const setPanelOpen = (open) => {
      panel.hidden = !open;
      crystalButton.setAttribute('aria-expanded', String(open));
      wrapper.classList.toggle('is-open', open);
      if (open) enabledInput.focus({ preventScroll: true });
    };

    crystalButton.addEventListener('click', () => setPanelOpen(panel.hidden));
    closeButton.addEventListener('click', () => setPanelOpen(false));

    enabledInput.addEventListener('change', () => {
      engine.setEnabled(enabledInput.checked);
      update();
    });

    volumeInput.addEventListener('input', () => {
      const value = Number(volumeInput.value) / 100;
      engine.setMasterVolume(value);
      if (value > 0 && !engine.settings.enabled) engine.setEnabled(true);
      update();
    });

    ambienceInput.addEventListener('input', () => {
      engine.setAmbienceVolume(Number(ambienceInput.value) / 100);
      update();
    });

    effectsInput.addEventListener('input', () => {
      engine.setEffectsVolume(Number(effectsInput.value) / 100);
      update();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!panel.hidden && !wrapper.contains(event.target)) setPanelOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        setPanelOpen(false);
        crystalButton.focus();
      }
    });

    engine.addEventListener('change', update);
    engine.addEventListener('ready', update);
    update();
  }

  const engine = new DarkLairSoundEngine();
  window.DarkLairSound = engine;
  window.DLTSound = engine; // Short backwards-compatible name.

  const startSoundSystem = () => {
    engine.initialise();
    createSoundControls(engine);
    engine.initialiseScrollEffects();
    engine.initialiseBattleEffects();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSoundSystem, { once: true });
  } else {
    startSoundSystem();
  }

  window.addEventListener('pagehide', () => {
    engine.stopAll(0.12);
  });
})();