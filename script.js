const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  });
});

function submitForm(event) {
  event.preventDefault();
  const name = document.getElementById('name').value.trim();
  const contact = document.getElementById('contactInfo').value.trim();
  const message = document.getElementById('message').value.trim();

  const subject = encodeURIComponent(`Inquiry SDE IoT — ${name}`);
  const body = encodeURIComponent(
    `Nama / Perusahaan: ${name}\nKontak: ${contact}\nKebutuhan: ${message || '-'}`
  );

  // Ganti alamat email di sini sebelum production.
  window.location.href = `mailto:hello@your-sde-domain.com?subject=${subject}&body=${body}`;
  return false;
}
