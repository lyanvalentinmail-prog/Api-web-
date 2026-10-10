document.addEventListener('DOMContentLoaded', () => {
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data && data.status) {
        document.getElementById('stat-endpoints').textContent = data.total_endpoints;
        document.getElementById('stat-categories').textContent = data.total_categories;
        document.getElementById('stat-requests').textContent = data.total_requests;
      }
    } catch (e) { /* sin métricas, la página sigue funcionando */ }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/endpoints');
      const catalog = await res.json();
      const grid = document.getElementById('cat-grid');
      grid.innerHTML = (catalog.categories || []).map(cat => `
        <div class="cat-card">
          <div class="top"><h3>${cat.name}</h3><span class="count">${cat.count} endpoints</span></div>
          <p>${cat.description}</p>
          <div class="routes">${(cat.endpoints || []).slice(0, 3).map(e => e.path).join('  ·  ')}${cat.count > 3 ? '  …' : ''}</div>
        </div>`).join('');
    } catch (e) {
      document.getElementById('cat-grid').innerHTML = '<p class="section-sub">No se pudo cargar el catálogo.</p>';
    }
  }

  loadStats();
  loadCategories();
  setInterval(loadStats, 10000);
});
