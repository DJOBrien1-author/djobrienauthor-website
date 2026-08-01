
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


/* Immersive sound and manuscript transitions.
   Sound is deliberately off by default and starts only after a visitor chooses it. */
(() => {
  const STORAGE_KEY = 'djobrien-archive-sound';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings = {
    control_label: 'Archive ambience', default_volume: 18, remember_choice: true,
    scroll_transition: true, archive_ambience: true, map_ambience: true, character_ambience: true
  };

  class ArchiveSoundscape {
    constructor() { this.ctx = null; this.master = null; this.nodes = []; this.enabled = false; this.mode = ''; }
    async enable() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = Math.max(.02, Math.min(.4, Number(settings.default_volume || 18) / 100));
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.enabled = true;
      this.startForPage();
    }
    disable() { this.enabled = false; this.stop(); }
    stop() {
      this.nodes.forEach(node => { try { node.stop?.(); } catch (_) {} try { node.disconnect?.(); } catch (_) {} });
      this.nodes = [];
    }
    noise(seconds = 2) {
      const length = this.ctx.sampleRate * seconds;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const out = buffer.getChannelData(0);
      for (let i=0;i<length;i++) out[i] = Math.random()*2-1;
      return buffer;
    }
    addWind(level=.07, frequency=520) {
      const source=this.ctx.createBufferSource(); source.buffer=this.noise(3); source.loop=true;
      const filter=this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=frequency;
      const gain=this.ctx.createGain(); gain.gain.value=level;
      const lfo=this.ctx.createOscillator(), lfoGain=this.ctx.createGain(); lfo.frequency.value=.08; lfoGain.gain.value=level*.55;
      lfo.connect(lfoGain).connect(gain.gain); source.connect(filter).connect(gain).connect(this.master);
      source.start(); lfo.start(); this.nodes.push(source,lfo,filter,gain,lfoGain);
    }
    addCrackle(level=.035) {
      const tick=()=>{ if(!this.enabled||!this.ctx) return; const osc=this.ctx.createOscillator(), g=this.ctx.createGain(); osc.type='triangle'; osc.frequency.value=70+Math.random()*120; g.gain.setValueAtTime(0,this.ctx.currentTime); g.gain.linearRampToValueAtTime(level*Math.random(),this.ctx.currentTime+.008); g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+.05+Math.random()*.12); osc.connect(g).connect(this.master); osc.start(); osc.stop(this.ctx.currentTime+.2); setTimeout(tick,180+Math.random()*850); };
      tick();
    }
    addSea() { this.addWind(.11,720); const osc=this.ctx.createOscillator(), gain=this.ctx.createGain(), lfo=this.ctx.createOscillator(), lg=this.ctx.createGain(); osc.type='sine'; osc.frequency.value=46; gain.gain.value=.018; lfo.frequency.value=.14; lg.gain.value=.014; lfo.connect(lg).connect(gain.gain); osc.connect(gain).connect(this.master); osc.start(); lfo.start(); this.nodes.push(osc,gain,lfo,lg); }
    startForPage(detail={}) {
      if(!this.enabled||!this.ctx) return; this.stop();
      const page=document.body.dataset.page||''; const slug=String(detail.slug||new URLSearchParams(location.search).get('entry')||'');
      if(page==='archive' && /widow|maelstrom|pirate|slaver/i.test(slug)) { this.mode='sea'; this.addSea(); this.addCrackle(.018); }
      else if((page==='archives'||page==='archive') && settings.archive_ambience) { this.mode='archive'; this.addWind(.045,360); this.addCrackle(); }
      else if(page==='world' && settings.map_ambience) { this.mode='world'; this.addWind(.06,560); }
      else if(page==='characters' && settings.character_ambience) { this.mode='characters'; this.addWind(.035,300); }
      else { this.mode='quiet'; this.addWind(.018,260); }
    }
    oneShot(kind='paper') {
      if(!this.enabled||!this.ctx) return;
      const now=this.ctx.currentTime;
      if(kind==='paper') {
        const src=this.ctx.createBufferSource(); src.buffer=this.noise(.8); const filter=this.ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=1500; filter.Q.value=.7; const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,now); g.gain.linearRampToValueAtTime(.12,now+.03); g.gain.exponentialRampToValueAtTime(.0001,now+.65); src.connect(filter).connect(g).connect(this.master); src.start();
      } else {
        const osc=this.ctx.createOscillator(), g=this.ctx.createGain(); osc.type='triangle'; osc.frequency.setValueAtTime(130,now); osc.frequency.exponentialRampToValueAtTime(55,now+.18); g.gain.setValueAtTime(.09,now); g.gain.exponentialRampToValueAtTime(.0001,now+.25); osc.connect(g).connect(this.master); osc.start(); osc.stop(now+.3);
      }
    }
  }

  const soundscape=new ArchiveSoundscape();
  const button=document.createElement('button');
  button.type='button'; button.className='ambience-toggle'; button.setAttribute('aria-pressed','false');
  const updateButton=()=>{ button.innerHTML=soundscape.enabled?'🔊 <span>Ambience on</span>':'🔇 <span>'+settings.control_label+'</span>'; button.setAttribute('aria-pressed',String(soundscape.enabled)); };
  button.addEventListener('click',async()=>{
    if(soundscape.enabled) soundscape.disable(); else await soundscape.enable();
    if(settings.remember_choice) localStorage.setItem(STORAGE_KEY,soundscape.enabled?'on':'off');
    updateButton();
  });
  document.body.appendChild(button); updateButton();

  fetch('content/experience.json').then(r=>r.ok?r.json():{}).then(value=>{
    settings={...settings,...value}; updateButton();
    if(settings.remember_choice && localStorage.getItem(STORAGE_KEY)==='on') {
      // Browsers may keep audio suspended until a gesture. The first click anywhere resumes it.
      const resume=async()=>{ await soundscape.enable(); updateButton(); document.removeEventListener('pointerdown',resume); };
      document.addEventListener('pointerdown',resume,{once:true});
    }
  }).catch(()=>{});

  window.addEventListener('archive:loaded',event=>soundscape.startForPage(event.detail||{}));

  const overlay=document.createElement('div'); overlay.className='scroll-opening'; overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML='<div class="scroll-opening-sheet"><span class="scroll-opening-seal">✦</span></div>';
  document.body.appendChild(overlay);

  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href*="archive.html?entry="]');
    if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank') return;
    if(reduceMotion||!settings.scroll_transition) { soundscape.oneShot('paper'); return; }
    event.preventDefault(); soundscape.oneShot('drawer'); setTimeout(()=>soundscape.oneShot('paper'),120);
    overlay.classList.add('is-opening');
    setTimeout(()=>{ location.href=link.href; },720);
  });
})();
