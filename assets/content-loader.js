
(async () => {
  const getPath = (obj, path) => path.split('.').reduce((acc, part) => {
    if (acc == null) return undefined;
    return /^\d+$/.test(part) ? acc[Number(part)] : acc[part];
  }, obj);

  try {
    const response = await fetch('/content/site.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    const data = await response.json();

    const pageKey = document.body.dataset.page;
    const pageBackground = pageKey ? getPath(data, `appearance.backgrounds.${pageKey}`) : null;
    if (pageBackground) document.documentElement.style.setProperty('--page-bg', `url("${pageBackground}")`);
    const overlay = Number(getPath(data, 'appearance.overlay_strength'));
    if (Number.isFinite(overlay)) document.documentElement.style.setProperty('--scene-overlay', Math.min(90, Math.max(15, overlay)) / 100);

    document.querySelectorAll('[data-content]').forEach(el => {
      const value = getPath(data, el.dataset.content);
      if (value !== undefined && value !== null) el.textContent = value;
    });

    document.querySelectorAll('[data-content-href]').forEach(el => {
      const value = getPath(data, el.dataset.contentHref);
      if (value) el.setAttribute('href', value);
    });

    document.querySelectorAll('[data-content-src]').forEach(el => {
      const value = getPath(data, el.dataset.contentSrc);
      if (value) el.setAttribute('src', value);
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



    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

    // Small, dependency-free Markdown renderer for archive articles.
    // HTML is escaped first, so CMS content cannot inject scripts or markup.
    const inlineMarkdown = value => {
      let text = esc(value);
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
      return text;
    };

    const renderMarkdown = value => {
      const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
      const html = [];
      let paragraph = [];
      let listType = '';
      const flushParagraph = () => {
        if (!paragraph.length) return;
        html.push(`<p>${inlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
        paragraph = [];
      };
      const closeList = () => {
        if (!listType) return;
        html.push(`</${listType}>`);
        listType = '';
      };
      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        const unordered = line.match(/^[-*+]\s+(.+)$/);
        const ordered = line.match(/^\d+[.)]\s+(.+)$/);
        const quote = line.match(/^>\s?(.*)$/);
        if (!line.trim()) {
          flushParagraph();
          closeList();
        } else if (heading) {
          flushParagraph();
          closeList();
          const level = Math.min(4, heading[1].length + 1); // article title is h1
          html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        } else if (unordered || ordered) {
          flushParagraph();
          const wanted = unordered ? 'ul' : 'ol';
          if (listType !== wanted) {
            closeList();
            listType = wanted;
            html.push(`<${listType}>`);
          }
          html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
        } else if (quote) {
          flushParagraph();
          closeList();
          html.push(`<blockquote><p>${inlineMarkdown(quote[1])}</p></blockquote>`);
        } else if (/^---+$/.test(line.trim())) {
          flushParagraph();
          closeList();
          html.push('<hr>');
        } else {
          closeList();
          paragraph.push(line);
        }
      }
      flushParagraph();
      closeList();
      return html.join('');
    };
    const videoEmbed = url => {
      if (!url) return '';
      const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/i);
      if (yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt[1])}`;
      const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
      if (vm) return `https://player.vimeo.com/video/${encodeURIComponent(vm[1])}`;
      return '';
    };

    const archivesList = document.querySelector('#archives-list');
    if (archivesList && Array.isArray(data.archives)) {
      const entries = [...data.archives].sort((a,b) => (Number(a.order)||999)-(Number(b.order)||999) || String(a.title || '').localeCompare(String(b.title || '')));
      const renderArchives = category => {
        const shown = category === 'All' ? entries : entries.filter(item => item.category === category);
        archivesList.innerHTML = shown.length ? shown.map(item => `
          <article class="panel archive-card${item.manuscript_image ? ' archive-scroll-card' : ''}">
            ${(item.manuscript_image || item.hero_image) ? `<img src="${esc(item.manuscript_image || item.hero_image)}" alt="${esc(item.hero_alt || '')}" loading="lazy">` : ''}
            <div class="archive-card-content">
              <p class="meta">${esc(item.category || 'Archive')}</p>
              <h2>${esc(item.title)}</h2>
              ${item.subtitle ? `<p><em>${esc(item.subtitle)}</em></p>` : ''}
              <p>${esc(item.newsletter_excerpt || '')}</p>
              <a class="btn" href="archive.html?entry=${encodeURIComponent(item.slug)}">Open manuscript</a>
            </div>
          </article>`).join('') : '<p class="panel">No manuscripts are filed in this section yet.</p>';
      };
      renderArchives('All');

      // A permanent, public manuscript index. Every new CMS topic appears here
      // automatically and links to its full archive entry.
      const archiveIndex = document.querySelector('#archive-index');
      if (archiveIndex) {
        archiveIndex.innerHTML = entries.length ? `
          <h2>Manuscript index</h2>
          <p class="archive-index-intro">Select any heading to open the complete record.</p>
          <ol class="archive-title-list">
            ${entries.map(item => `<li><a href="archive.html?entry=${encodeURIComponent(item.slug)}"><strong>${esc(item.title)}</strong>${item.category ? `<span>${esc(item.category)}</span>` : ''}</a></li>`).join('')}
          </ol>` : '<h2>Manuscript index</h2><p>No manuscripts have been filed yet.</p>';
      }

      const filters = document.querySelector('#archive-filters');
      if (filters) {
        const categories = ['All', ...new Set(entries.map(item => item.category).filter(Boolean))];
        filters.innerHTML = categories.map((category,index) => `<button class="archive-filter" type="button" aria-pressed="${index===0}" data-category="${esc(category)}">${esc(category)}</button>`).join('');
        filters.addEventListener('click', event => {
          const button = event.target.closest('[data-category]');
          if (!button) return;
          filters.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed','false'));
          button.setAttribute('aria-pressed','true');
          renderArchives(button.dataset.category);
        });
      }
    }

    const archiveEntry = document.querySelector('#archive-entry');
    if (archiveEntry && Array.isArray(data.archives)) {
      const slug = new URLSearchParams(location.search).get('entry') || data.archives[0]?.slug;
      const item = data.archives.find(entry => entry.slug === slug);
      if (!item) {
        archiveEntry.innerHTML = '<h1>Manuscript not found</h1><p>This record may have been moved or lost.</p><p><a class="btn" href="archives.html">Return to the Archives</a></p>';
      } else {
        document.title = `${item.title} | Brihanon’s Archives`;
        const description = document.querySelector('meta[name="description"]');
        if (description && item.seo_description) description.setAttribute('content', item.seo_description);
        const gallery = Array.isArray(item.gallery) && item.gallery.length ? `<div class="archive-gallery">${item.gallery.map(image => `<figure><img src="${esc(image.image)}" alt="${esc(image.alt || '')}" loading="lazy">${image.caption ? `<figcaption>${esc(image.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
        const hosted = videoEmbed(item.video_url);
        const video = item.video_file ? `<figure class="archive-video"><video controls preload="metadata" ${item.hero_image ? `poster="${esc(item.hero_image)}"` : ''}><source src="${esc(item.video_file)}"></video>${item.video_caption ? `<figcaption>${esc(item.video_caption)}</figcaption>` : ''}</figure>` : hosted ? `<figure class="archive-video"><iframe src="${hosted}" title="${esc(item.video_caption || item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>${item.video_caption ? `<figcaption>${esc(item.video_caption)}</figcaption>` : ''}</figure>` : '';
        archiveEntry.innerHTML = `
          <header class="archive-entry-header"><p class="meta">${esc(item.category || 'Archive')}</p><h1>${esc(item.title)}</h1>${item.subtitle ? `<p><em>${esc(item.subtitle)}</em></p>` : ''}</header>
          ${item.manuscript_image ? `<figure class="archive-scroll-view"><a href="${esc(item.manuscript_image)}" target="_blank" rel="noopener" aria-label="Open ${esc(item.title)} at full size"><img src="${esc(item.manuscript_image)}" alt="${esc(item.hero_alt || '')}"></a><figcaption>Select the scroll to open the full-size manuscript.</figcaption></figure>` : (item.hero_image ? `<figure class="archive-hero"><img src="${esc(item.hero_image)}" alt="${esc(item.hero_alt || '')}"></figure>` : '')}
          ${item.body ? `<div class="archive-body">${renderMarkdown(item.body)}</div>` : ''}${gallery}${video}
          ${item.manuscript_image ? '' : `<p class="archive-signature">Recorded faithfully by<br><strong>Brihanon</strong><br><small>Arch Scribe of the Western Isles</small></p>`}`;
        const related = document.querySelector('#archive-related');
        if (related) {
          const others = data.archives.filter(entry => entry.slug !== item.slug).slice(0,3);
          related.innerHTML = others.length ? `<h2>Another scroll awaits</h2><div class="archive-grid">${others.map(entry => `<a class="panel" href="archive.html?entry=${encodeURIComponent(entry.slug)}"><strong>${esc(entry.title)}</strong><br><small>${esc(entry.category || '')}</small></a>`).join('')}</div>` : '';
        }
      }
    }

    if (window.instgrm?.Embeds) window.instgrm.Embeds.process();
  } catch (error) {
    console.warn('Editable content could not be loaded. Static fallback text remains visible.', error);
  }
})();
