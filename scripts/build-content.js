const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const readFolder = folder => fs.readdirSync(path.join(root, folder))
  .filter(name => name.endsWith('.json'))
  .map(name => {
    const item = read(path.join(folder, name));
    // Decap CMS creates new archive filenames from the title. The filename is
    // therefore a safe fallback URL slug, so authors never need to type one.
    if (folder === 'content/archives' && !item.slug) {
      item.slug = path.basename(name, '.json');
    }
    return item;
  })
  .sort((a,b) => (Number(a.order)||9999) - (Number(b.order)||9999));
const home = read('content/home.json');
const bookEntries = readFolder('content/books');
const books = {};
for (const book of bookEntries) {
  const {slug, order, subtitle, cover_image, ...publicBook} = book;
  books[slug] = {...publicBook, subtitle, cover_image};
}
books.trilogy_video_url = home.trilogy_video_url || '';
const data = {
  site: home.site,
  buttons: home.buttons,
  crystals: home.crystals,
  books,
  characters: readFolder('content/characters').map(({order,...x})=>x),
  timeline: readFolder('content/timeline').map(({order,...x})=>x),
  reviews: readFolder('content/reviews').map(({order,...x})=>x),
  about: read('content/about.json'),
  contact: read('content/contact.json'),
  news: readFolder('content/news').map(({order,...x})=>x),
  archives: readFolder('content/archives').map(({order,...x})=>x),
  social: read('content/social.json'),
  appearance: read('content/appearance.json')
};
fs.writeFileSync(path.join(root, 'content/site.json'), JSON.stringify(data, null, 2) + '\n');
console.log('Generated content/site.json from organised CMS files.');
