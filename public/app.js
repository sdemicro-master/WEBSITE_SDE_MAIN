const rupiah = (n) => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(n);

async function loadProducts() {
  const grid = document.querySelector('#produk-grid');
  try {
    const res = await fetch('/api/products?featured=1');
    const products = await res.json();
    if (!products.length) {
      grid.innerHTML = '<div class="empty">Belum ada produk.</div>';
      return;
    }
    grid.innerHTML = products.map(p => `
      <article class="product-card">
        <div class="product-image">
          ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.name)}">` : `<div class="image-placeholder"><span>SDE</span></div>`}
        </div>
        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || '')}</p>
          <div class="product-bottom">
  <b>${rupiah(p.price)}</b>
  <a class="detail-link" href="/produk.html?slug=${encodeURIComponent(p.slug)}">Detail →</a>
</div>
        </div>
      </article>`).join('');
  } catch {
    grid.innerHTML = '<div class="empty">Gagal memuat produk.</div>';
  }
}
function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
}
loadProducts();
