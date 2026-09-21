const $ = (s) => document.querySelector(s);
const rupiah = (n) => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(n);
let products = [];
let pendingImage = null;

async function api(url, options={}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

async function boot() {
  const me = await api('/api/admin/me');
  if (me.authenticated) showAdmin();
  else showLogin();
}

function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#admin-view').classList.add('hidden');
}
function showAdmin() {
  $('#login-view').classList.add('hidden');
  $('#admin-view').classList.remove('hidden');
  loadProducts();
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('/api/admin/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password: $('#password').value})
    });
    showAdmin();
  } catch (err) { $('#login-error').textContent = err.message; }
});

$('#logout').onclick = async () => {
  await api('/api/admin/logout', {method:'POST'});
  showLogin();
};

async function loadProducts() {
  products = await api('/api/admin/products');
  render();
}
function render() {
  const q = ($('#search').value || '').toLowerCase();
  const list = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
  $('#stat-total').textContent = products.length;
  $('#stat-active').textContent = products.filter(p=>p.active).length;
  $('#stat-featured').textContent = products.filter(p=>p.featured).length;
  $('#product-table').innerHTML = list.map(p => `
    <tr>
      <td><div class="td-product">${p.image_url ? `<img src="${p.image_url}">` : '<div class="thumb">SDE</div>'}<div><b>${esc(p.name)}</b><small>${esc(p.slug)}</small></div></div></td>
      <td>${esc(p.category)}</td>
      <td>${rupiah(p.price)}</td>
      <td><span class="status ${p.active?'on':'off'}">${p.active?'Aktif':'Nonaktif'}</span></td>
      <td>${p.featured?'★':'—'}</td>
      <td><div class="row-actions"><button onclick="editProduct(${p.id})">Edit</button><button class="danger-text" onclick="deleteProduct(${p.id})">Hapus</button></div></td>
    </tr>`).join('');
}
$('#search').oninput = render;

function resetForm() {
  pendingImage = null;
  $('#product-form').reset();
  $('#product-id').value = '';
  $('#image-key').value = '';
  $('#active').checked = true;
  $('#featured').checked = true;
  $('#preview').innerHTML = '<span>Belum ada foto</span>';
  $('#upload-status').textContent = '';
  $('#form-error').textContent = '';
  $('#modal-title').textContent = 'Produk Baru';
}
function openModal() { $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
$('#new-product').onclick = () => { resetForm(); openModal(); };
$('#close-modal').onclick = closeModal;
$('#cancel').onclick = closeModal;

window.editProduct = (id) => {
  const p = products.find(x => x.id === id);
  if (!p) return;
  $('#modal-title').textContent = 'Edit Produk';
  $('#product-id').value = p.id;
  $('#image-key').value = p.image_key || '';
  $('#name').value = p.name;
  $('#slug').value = p.slug;
  $('#category').value = p.category;
  $('#price').value = p.price;
  $('#description').value = p.description;
  $('#shopee-url').value = p.shopee_url || '';
  $('#tokopedia-url').value = p.tokopedia_url || '';
  $('#contact-url').value = p.contact_url || '';
  $('#sort-order').value = p.sort_order;
  $('#active').checked = p.active;
  $('#featured').checked = p.featured;
  $('#preview').innerHTML = p.image_url ? `<img src="${p.image_url}" alt="">` : '<span>Belum ada foto</span>';
  $('#upload-status').textContent = '';
  $('#form-error').textContent = '';
  openModal();
};

$('#photo').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    $('#upload-status').textContent = 'Maksimum 1 MB.';
    e.target.value = '';
    return;
  }
  $('#upload-status').textContent = 'Menyiapkan foto…';
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result);
    pendingImage = { image_base64: result.split(',')[1], mime: file.type };
    $('#preview').innerHTML = `<img src="${result}" alt="">`;
    $('#upload-status').textContent = 'Foto siap disimpan ke D1.';
  };
  reader.readAsDataURL(file);
});

$('#product-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('#form-error').textContent = '';
  const id = $('#product-id').value;
  const body = {
    name: $('#name').value,
    slug: $('#slug').value,
    category: $('#category').value,
    price: Number($('#price').value || 0),
    description: $('#description').value,
    shopee_url: $('#shopee-url').value,
    tokopedia_url: $('#tokopedia-url').value,
    contact_url: $('#contact-url').value,
    sort_order: Number($('#sort-order').value || 0),
    active: $('#active').checked,
    featured: $('#featured').checked,
  };
  $('#save').disabled = true;
  try {
    let saved;
    if (id) saved = await api(`/api/admin/products/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    else saved = await api('/api/admin/products', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const savedId = id || saved.id;
    if (pendingImage && savedId) {
      $('#upload-status').textContent = 'Menyimpan foto ke D1…';
      await api(`/api/admin/products/${savedId}/image`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(pendingImage)
      });
    }
    closeModal();
    await loadProducts();
    notice('Produk berhasil disimpan.');
  } catch (err) {
    $('#form-error').textContent = err.message;
  } finally { $('#save').disabled = false; }
});

window.deleteProduct = async (id) => {
  const p = products.find(x=>x.id===id);
  if (!confirm(`Hapus "${p?.name}"? Foto R2 juga akan dihapus.`)) return;
  try {
    await api(`/api/admin/products/${id}`, {method:'DELETE'});
    await loadProducts();
    notice('Produk dihapus.');
  } catch (err) { notice(err.message, true); }
};

function notice(message, error=false) {
  const el = $('#notice');
  el.textContent = message;
  el.classList.toggle('error-notice', error);
  el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'), 3500);
}
function esc(s='') { return s.replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x])); }
boot().catch(()=>showLogin());
