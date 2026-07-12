
(async () => {
  const getPath = (obj, path) => path.split('.').reduce((acc, part) => {
    if (acc == null) return undefined;
    return /^\d+$/.test(part) ? acc[Number(part)] : acc[part];
  }, obj);

  try {
    const response = await fetch('/content/site.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    const data = await response.json();

    document.querySelectorAll('[data-content]').forEach(el => {
      const value = getPath(data, el.dataset.content);
      if (value !== undefined && value !== null) el.textContent = value;
    });

    document.querySelectorAll('[data-content-href]').forEach(el => {
      const value = getPath(data, el.dataset.contentHref);
      if (value) el.setAttribute('href', value);
    });

    document.querySelectorAll('[data-content-attr]').forEach(el => {
      const value = getPath(data, el.dataset.contentAttr);
      if (value) el.setAttribute('data-instgrm-permalink', value);
    });

    const characters = document.querySelector('#characters-list');
    if (characters && Array.isArray(data.characters)) {
      const classes = ['name-brinn','name-megan','name-ben','name-ultor','name-helfen','name-shade'];
      characters.innerHTML = data.characters.map((item, i) => `
        <article class="panel">
          <h3><span class="animated-name ${classes[i] || ''}">${item.name}</span></h3>
          <p><span class="character-role">Role: ${item.role}</span><br>${item.description}</p>
        </article>`).join('');
    }

    const timeline = document.querySelector('#timeline-list');
    if (timeline && Array.isArray(data.timeline)) {
      timeline.innerHTML = data.timeline.map(item => `
        <div class="timeline-item panel">
          <time>${item.period}</time>
          <div><h3>${item.title}</h3><p>${item.description}</p></div>
        </div>`).join('');
    }

    const reviews = document.querySelector('#reviews-list');
    if (reviews && Array.isArray(data.reviews)) {
      reviews.innerHTML = data.reviews.map(item => `
        <blockquote class="panel quote">“${item.quote}”
          <footer class="review-source">- ${item.source}</footer>
        </blockquote>`).join('');
    }

    const news = document.querySelector('#news-list');
    if (news && Array.isArray(data.news)) {
      news.innerHTML = data.news.map(item => `
        <article class="panel news-card">
          <p class="meta">${item.category}</p>
          <h2>${item.title}</h2>
          <p>${item.text}</p>
        </article>`).join('');
    }

    if (window.instgrm?.Embeds) window.instgrm.Embeds.process();
  } catch (error) {
    console.warn('Editable content could not be loaded. Static fallback text remains visible.', error);
  }
})();
