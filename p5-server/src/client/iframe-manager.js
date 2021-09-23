window.addEventListener('load', () => {
  const links = Array.from(document.querySelectorAll('a[target=sketch]'));
  const base = document.baseURI.replace(/#.*/, '');

  links.forEach(elt => {
    elt.addEventListener('click', () => {
      document.location.hash = encodeURIComponent('!' + relative(elt.href));
    });
  });

  if (document.location.hash.startsWith('#!')) {
    let url = decodeURIComponent(document.location.hash.slice(2));
    if (!url.match(/^https?:\/\//)) url = base + url;
    if (links.some(elt => elt.href === url)) {
      const iframe = document.getElementById('sketch');
      iframe.src = url;
    }
  }

  function relative(url) {
    return url.startsWith(base) ? url.slice(base.length) : url;
  }
});
