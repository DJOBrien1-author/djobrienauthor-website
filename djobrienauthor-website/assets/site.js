
const toggle=document.querySelector('.nav-toggle');
const nav=document.querySelector('nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});}
const mapImage=document.querySelector('#map-image');
document.querySelectorAll('[data-map]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-map]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(mapImage){mapImage.src=btn.dataset.map;mapImage.alt=btn.dataset.alt;}
}));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:.12});
document.querySelectorAll('.fade-up').forEach(el=>observer.observe(el));

document.querySelectorAll('.animated-title').forEach(el => {
  if (el.querySelector('.spark-layer')) return;
  const layer = document.createElement('span');
  layer.className = 'spark-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    layer.appendChild(spark);
  }
  el.appendChild(layer);
});

document.querySelectorAll('[data-crystal]').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.dataset.crystal;
    const target = document.querySelector(`[data-panel="${key}"]`);
    const isOpen = !target.hasAttribute('hidden');

    document.querySelectorAll('[data-panel]').forEach(panel => panel.setAttribute('hidden', ''));
    document.querySelectorAll('[data-crystal]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));

    if (!isOpen) {
      target.removeAttribute('hidden');
      button.setAttribute('aria-expanded', 'true');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
});

(() => {
  const mapImage = document.querySelector('#map-image');
  const modalImage = document.querySelector('#modal-map-image');
  const caption = document.querySelector('#map-caption');
  const mapButtons = document.querySelectorAll('[data-map]');
  let scale = 1;

  const applyScale = () => {
    if (mapImage) mapImage.style.transform = `scale(${scale})`;
    if (modalImage) modalImage.style.transform = `scale(${scale})`;
  };

  mapButtons.forEach(button => {
    button.addEventListener('click', () => {
      mapButtons.forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      const src = button.dataset.map;
      const alt = button.dataset.alt;
      if (mapImage) {
        mapImage.src = src;
        mapImage.alt = alt;
      }
      if (modalImage) {
        modalImage.src = src;
        modalImage.alt = `Enlarged ${alt.toLowerCase()}`;
      }
      if (caption) {
        caption.innerHTML = src.includes('wyvern-regional')
          ? 'Regional map from <em>Wyvern</em>'
          : 'Expanded world map from <em>Maelstrom</em> and <em>Dragon Knight</em>';
      }
      scale = 1;
      applyScale();
    });
  });

  document.querySelector('#zoom-in')?.addEventListener('click', () => {
    scale = Math.min(2.5, scale + 0.2);
    applyScale();
  });
  document.querySelector('#zoom-out')?.addEventListener('click', () => {
    scale = Math.max(0.6, scale - 0.2);
    applyScale();
  });
  document.querySelector('#reset-map')?.addEventListener('click', () => {
    scale = 1;
    applyScale();
  });

  const modal = document.querySelector('#map-modal');
  document.querySelector('#open-map')?.addEventListener('click', () => {
    if (!modal) return;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  });
  document.querySelector('#close-map')?.addEventListener('click', () => {
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  });
  modal?.addEventListener('click', event => {
    if (event.target === modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  });
})();

/* Immersive ambient sound system. Original audio created for this website. */
(() => {
  'use strict';

  const STORAGE = {
    muted: 'darkLairSoundMuted',
    volume: 'darkLairSoundVolume'
  };
  const DEFAULT_VOLUME = 0.24;
  const page = document.body.dataset.page || 'home';
  const base = 'assets/audio/';
  const tracks = {};
  let unlocked = false;
  let lastEffectAt = 0;
  let effectTimer = null;

  const storedVolume = Number.parseFloat(localStorage.getItem(STORAGE.volume));
  let volume = Number.isFinite(storedVolume) ? Math.min(1, Math.max(0, storedVolume)) : DEFAULT_VOLUME;
  let muted = localStorage.getItem(STORAGE.muted) === 'true';

  const makeAudio = (file, loop = false) => {
    const audio = new Audio(`${base}${file}`);
    audio.preload = 'auto';
    audio.loop = loop;
    audio.volume = 0;
    return audio;
  };

  tracks.wind = makeAudio('wind.wav', true);
  tracks.fire = makeAudio('fire.wav', true);
  tracks.forest = makeAudio('forest.wav', true);
  tracks.hum = makeAudio('crystal-hum.wav', true);
  tracks.parchment = makeAudio('parchment.wav');
  tracks.quill = makeAudio('quill.wav');
  tracks.raven = makeAudio('raven.wav');
  tracks.thunder = makeAudio('thunder.wav');
  tracks.battle = makeAudio('battle.wav');

  const panel = document.createElement('div');
  panel.className = 'sound-control';
  panel.innerHTML = `
    <button class="sound-crystal" type="button" aria-expanded="false" aria-controls="sound-panel" title="Sound controls">
      <span class="sound-crystal-gem" aria-hidden="true"></span>
      <span class="sr-only">Open sound controls</span>
    </button>
    <div class="sound-panel" id="sound-panel" hidden>
      <div class="sound-panel-heading">
        <strong>Ambient sound</strong>
        <button class="sound-toggle" type="button" aria-pressed="${String(!muted)}">${muted ? 'Turn on' : 'Turn off'}</button>
      </div>
      <label for="sound-volume">Volume <output id="sound-volume-value">${Math.round(volume * 100)}%</output></label>
      <input id="sound-volume" type="range" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="Ambient sound volume">
      <p class="sound-note">Sound begins after your first click or key press if the browser blocks autoplay.</p>
    </div>`;
  document.body.appendChild(panel);

  const crystal = panel.querySelector('.sound-crystal');
  const gem = panel.querySelector('.sound-crystal-gem');
  const controls = panel.querySelector('.sound-panel');
  const toggleButton = panel.querySelector('.sound-toggle');
  const slider = panel.querySelector('#sound-volume');
  const output = panel.querySelector('#sound-volume-value');

  const setGemState = () => {
    gem.classList.toggle('is-on', !muted && volume > 0);
    crystal.setAttribute('title', muted ? 'Sound is off' : `Sound is on at ${Math.round(volume * 100)}%`);
    toggleButton.textContent = muted ? 'Turn on' : 'Turn off';
    toggleButton.setAttribute('aria-pressed', String(!muted));
  };

  const targetLevels = () => {
    const v = muted ? 0 : volume;
    const archive = page.includes('archive') || document.body.classList.contains('archive-page');
    if (archive) return { wind: v * 0.22, fire: v * 0.72, forest: 0, hum: v * 0.12 };
    if (page === 'world') return { wind: v * 0.18, fire: 0, forest: v * 0.68, hum: v * 0.08 };
    if (page === 'timeline') return { wind: v * 0.38, fire: 0, forest: 0, hum: v * 0.20 };
    if (page === 'home' || page === 'trilogy' || page === 'start') return { wind: v * 0.52, fire: 0, forest: 0, hum: v * 0.22 };
    return { wind: v * 0.26, fire: 0, forest: 0, hum: v * 0.10 };
  };

  const fadeTo = (audio, target, duration = 600) => {
    const start = audio.volume;
    const started = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - started) / duration);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * p));
      if (p < 1) requestAnimationFrame(tick);
      else if (target === 0 && !audio.loop) audio.pause();
    };
    requestAnimationFrame(tick);
  };

  const applyLevels = () => {
    const levels = targetLevels();
    Object.entries(levels).forEach(([name, level]) => {
      const audio = tracks[name];
      if (unlocked && level > 0 && audio.paused) audio.play().catch(() => {});
      fadeTo(audio, level);
    });
    setGemState();
  };

  const playEffect = (name, strength = 1, force = false) => {
    if (!unlocked || muted || volume <= 0) return;
    const now = Date.now();
    if (!force && now - lastEffectAt < 3200) return;
    lastEffectAt = now;
    const original = tracks[name];
    if (!original) return;
    const sound = original.cloneNode();
    sound.volume = Math.min(1, volume * strength);
    sound.play().catch(() => {});
  };

  const scheduleAtmosphere = () => {
    clearTimeout(effectTimer);
    if (muted) return;
    const archive = page.includes('archive') || document.body.classList.contains('archive-page');
    const delay = archive ? 4500 + Math.random() * 4500 : 5500 + Math.random() * 7000;
    effectTimer = setTimeout(() => {
      if (archive) playEffect(Math.random() < 0.55 ? 'quill' : 'parchment', 0.55);
      else if (page === 'home' || page === 'timeline') playEffect(Math.random() < 0.65 ? 'raven' : 'thunder', 0.40);
      else if (page === 'world') playEffect('raven', 0.28);
      scheduleAtmosphere();
    }, delay);
  };

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    applyLevels();
    if (!muted) {
      setTimeout(() => playEffect(page.includes('archive') ? 'parchment' : 'raven', 0.32, true), 1800);
      scheduleAtmosphere();
    }
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, unlock, { once: true, passive: true });
  });

  crystal.addEventListener('click', event => {
    event.stopPropagation();
    unlock();
    const open = controls.hasAttribute('hidden');
    controls.toggleAttribute('hidden', !open);
    crystal.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', event => {
    if (!panel.contains(event.target)) {
      controls.setAttribute('hidden', '');
      crystal.setAttribute('aria-expanded', 'false');
    }
  });

  toggleButton.addEventListener('click', () => {
    unlock();
    muted = !muted;
    localStorage.setItem(STORAGE.muted, String(muted));
    applyLevels();
    if (!muted) scheduleAtmosphere();
    else clearTimeout(effectTimer);
  });

  slider.addEventListener('input', () => {
    unlock();
    volume = Number(slider.value) / 100;
    output.value = `${slider.value}%`;
    output.textContent = `${slider.value}%`;
    if (volume > 0 && muted) muted = false;
    localStorage.setItem(STORAGE.volume, String(volume));
    localStorage.setItem(STORAGE.muted, String(muted));
    applyLevels();
  });

  // Scroll/manuscript effects. These selectors also support future Brihanon's Archives pages.
  const scrollSelector = '.scroll, .archive-scroll, .manuscript, [data-scroll], [data-manuscript]';
  const scrollObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.target.dataset.soundPlayed === 'true') return;
      entry.target.dataset.soundPlayed = 'true';
      setTimeout(() => playEffect('parchment', 0.58), 250);
      setTimeout(() => playEffect('quill', 0.36), 2600);
    });
  }, { threshold: 0.35 });
  document.querySelectorAll(scrollSelector).forEach(el => {
    scrollObserver.observe(el);
    el.addEventListener('click', () => playEffect('parchment', 0.42));
  });

  // Brief battle sound when a visitor reaches a war-related scene.
  const battleWords = /\b(war|battle|siege|army|armies|horde|invasion|invading|soldier|campaign)\b/i;
  const battleCandidates = [...document.querySelectorAll('article, section, .panel, .timeline-item')]
    .filter(el => battleWords.test(el.textContent || ''));
  const battleObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.target.dataset.battleSoundPlayed === 'true') return;
      entry.target.dataset.battleSoundPlayed = 'true';
      setTimeout(() => playEffect('battle', 0.52), 700);
    });
  }, { threshold: 0.52 });
  battleCandidates.forEach(el => battleObserver.observe(el));

  setGemState();

  // Attempt autoplay quietly. Most browsers will defer it until unlock().
  if (!muted) {
    tracks.wind.play().then(() => {
      unlocked = true;
      applyLevels();
      scheduleAtmosphere();
    }).catch(() => {});
  }
})();
