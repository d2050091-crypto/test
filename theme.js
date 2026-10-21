// თემის არჩევა გვერდის ჩატვირთვამდე (ციმციმის თავიდან ასაცილებლად)
(function () {
  var t = null;
  try { t = localStorage.getItem('cda-theme'); } catch (e) {}
  if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
