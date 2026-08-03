
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
