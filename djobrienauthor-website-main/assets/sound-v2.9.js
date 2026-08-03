/**
 * Dark Lair Trilogy sound engine, version 2.9.
 * Uses real WAV assets instead of generated Web Audio oscillators.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'dltSoundSettingsV2';
  const defaults = {
    enabled: true,
    master: 0.45,
    ambience: 0.55,
    effects: 0.9
  };

  function loadSettings() {
    try {
      return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return Object.assign({}, defaults);
    }
  }

  class SoundEngine {
    constructor() {
      this.settings = loadSettings();
      this.ambience = null;
      this.lastScroll = 0;
      this.lastBattle = 0;
      this.observer = null;
      this.mutationObserver = null;
    }

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    }

    volume(kind) {
      return this.settings.enabled ? this.settings.master * this.settings[kind] : 0;
    }

    makeAudio(src, loop = false, kind = 'effects') {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.loop = loop;
      audio.volume = Math.min(1, Math.max(0, this.volume(kind)));
      return audio;
    }

    startAmbience(name) {
      if (!this.settings.enabled) return false;
      const map = {
        archive: 'assets/audio/archive-ambience.wav',
        archives: 'assets/audio/archive-ambience.wav',
        world: 'assets/audio/forest-ambience.wav'
      };
      const src = map[name];
      if (!src) {
        this.stopAmbience();
        return false;
      }
      if (this.ambience && this.ambience.dataset.zone === name) return true;
      this.stopAmbience();
      const audio = this.makeAudio(src, true, 'ambience');
      audio.dataset.zone = name;
      this.ambience = audio;
      audio.play().catch(() => {});
      return true;
    }

    startPageAmbience() {
      const page = document.body ? document.body.dataset.page || '' : '';
      return this.startAmbience(page);
    }

    stopAmbience() {
      if (!this.ambience) return;
      this.ambience.pause();
      this.ambience.currentTime = 0;
      this.ambience = null;
    }

    play(src) {
      if (!this.settings.enabled) return false;
      const audio = this.makeAudio(src, false, 'effects');
      audio.play().catch(() => {});
      return true;
    }

    playParchment() {
      return this.play('assets/audio/parchment-opening-zapsplat-v3.wav');
    }


    playBattle() {
      return this.play('assets/audio/battle.wav');
    }

    playRaven() {
      return this.play('assets/audio/raven.wav');
    }

    setEnabled(value) {
      this.settings.enabled = Boolean(value);
      this.save();
      if (this.settings.enabled) this.startPageAmbience();
      else this.stopAmbience();
      this.refreshVolumes();
    }

    setMaster(value) {
      this.settings.master = Number(value);
      this.save();
      this.refreshVolumes();
    }

    setAmbience(value) {
      this.settings.ambience = Number(value);
      this.save();
      this.refreshVolumes();
    }

    setEffects(value) {
      this.settings.effects = Number(value);
      this.save();
    }

    refreshVolumes() {
      if (this.ambience) this.ambience.volume = this.volume('ambience');
    }

    initialiseTriggers() {
      const page = document.body ? document.body.dataset.page || '' : '';

      // Play the selected manuscript-opening sound immediately when a scroll is chosen.
      if (page === 'archives') {
        document.addEventListener('click', (event) => {
          const link = event.target.closest('#archives-list a, a[href*="archive.html"]');
          if (!link) return;

          event.preventDefault();
          const destination = link.href;

          this.playParchment();
          window.setTimeout(() => {
            window.location.href = destination;
          }, 3150);
        });
      }

    }
  }

  function createControls(engine) {
    if (document.getElementById('dlt-sound-control')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'dlt-sound-control';
    wrapper.className = 'dlt-sound-control';
    wrapper.innerHTML = `
      <button class="dlt-sound-crystal" type="button" aria-label="Sound settings">◆</button>
      <div class="dlt-sound-panel" hidden>
        <button class="dlt-sound-close" type="button" aria-label="Close">×</button>
        <label><input type="checkbox" data-enabled> Sound on</label>
        <label>Master <input type="range" min="0" max="100" value="45" data-master></label>
        <label>Ambience <input type="range" min="0" max="100" value="55" data-ambience></label>
        <label>Effects <input type="range" min="0" max="100" value="90" data-effects></label>
      </div>
    `;
    document.body.appendChild(wrapper);

    const panel = wrapper.querySelector('.dlt-sound-panel');
    const enabled = wrapper.querySelector('[data-enabled]');
    const master = wrapper.querySelector('[data-master]');
    const ambience = wrapper.querySelector('[data-ambience]');
    const effects = wrapper.querySelector('[data-effects]');

    enabled.checked = engine.settings.enabled;
    master.value = Math.round(engine.settings.master * 100);
    ambience.value = Math.round(engine.settings.ambience * 100);
    effects.value = Math.round(engine.settings.effects * 100);

    wrapper.querySelector('.dlt-sound-crystal').addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      engine.startPageAmbience();
    });
    wrapper.querySelector('.dlt-sound-close').addEventListener('click', () => panel.hidden = true);

    enabled.addEventListener('change', () => engine.setEnabled(enabled.checked));
    master.addEventListener('input', () => engine.setMaster(Number(master.value) / 100));
    ambience.addEventListener('input', () => engine.setAmbience(Number(ambience.value) / 100));
    effects.addEventListener('input', () => engine.setEffects(Number(effects.value) / 100));

    document.addEventListener('pointerdown', () => engine.startPageAmbience(), { once: true });
    document.addEventListener('keydown', () => engine.startPageAmbience(), { once: true });
  }

  const engine = new SoundEngine();
  window.DarkLairSound = engine;

  const start = () => {
    createControls(engine);
    engine.startPageAmbience();
    engine.initialiseTriggers();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
