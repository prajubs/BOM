/* script.js
 - Client-only frontend for Component Dashboard
 - Resizes images client-side to limit storage/PDF size
 - Stores list in localStorage as base64 images
*/

const STORAGE_KEY = 'componentList_v2';
const MAX_IMAGE_SIDE = 300; // px - will resize larger images down to this

// DOM elements
const compForm = document.getElementById('componentForm');
const nameInput = document.getElementById('compName');
const pkgInput = document.getElementById('compPackage'); // ✅ new field
const qtyInput = document.getElementById('compQty');
const fileInput = document.getElementById('compImage');
const tbody = document.getElementById('compTbody');
const emptyHint = document.getElementById('emptyHint');
const exportBtn = document.getElementById('exportPdfBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

let components = [];

// --- Utilities ---
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  components = raw ? JSON.parse(raw) : [];
}

// Resize image file to base64 with canvas. Maintains aspect ratio.
// Returns Promise<string> with dataURL.
function resizeImageFile(file, maxSide = MAX_IMAGE_SIDE) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxSide && height <= maxSide) {
          resolve(e.target.result); // already small enough
          return;
        }
        const scale = maxSide / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(resizedDataUrl);
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

// Render table
function render() {
  tbody.innerHTML = '';
  if (components.length === 0) {
    emptyHint.style.display = 'block';
    return;
  }
  emptyHint.style.display = 'none';
  components.forEach((c, idx) => {
    const tr = document.createElement('tr');

    const tdIdx = document.createElement('td');
    tdIdx.textContent = idx + 1;

    const tdImg = document.createElement('td');
    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = c.name;
    img.src = c.image || placeholderDataURI();
    tdImg.appendChild(img);

    const tdName = document.createElement('td');
    tdName.textContent = c.name;

    const tdPkg = document.createElement('td'); // ✅ new column
    tdPkg.textContent = c.package || '-';

    const tdQty = document.createElement('td');
    tdQty.textContent = c.quantity;

    const tdActions = document.createElement('td');
    tdActions.className = 'table-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn ghost';
    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
    delBtn.onclick = () => {
      if (!confirm(`Delete component "${c.name}"?`)) return;
      components = components.filter((x) => x.id !== c.id);
      saveToStorage();
      render();
    };

    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit';
    editBtn.onclick = () => openEditModal(c.id);

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdIdx);
    tr.appendChild(tdImg);
    tr.appendChild(tdName);
    tr.appendChild(tdPkg); // ✅ appended package
    tr.appendChild(tdQty);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

// placeholder tiny image as data URI (when no image provided)
function placeholderDataURI() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <rect width='100%' height='100%' fill='#0d1720' />
    <text x='50%' y='50%' font-size='20' fill='#3b5160' text-anchor='middle' dy='.35em'>No Image</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// --- Edit support (simple inline prompt) ---
function openEditModal(id) {
  const comp = components.find((c) => c.id === id);
  if (!comp) return;
  const newName = prompt('Edit component name:', comp.name);
  if (newName === null) return; // cancelled
  const newPkg = prompt('Edit package type:', comp.package || ''); // ✅ package edit
  if (newPkg === null) return;
  const newQty = prompt('Edit quantity (number):', comp.quantity);
  if (newQty === null) return;
  const parsed = parseInt(newQty);
  if (Number.isNaN(parsed) || parsed < 0) {
    alert('Invalid quantity.');
    return;
  }
  comp.name = newName.trim() || comp.name;
  comp.package = newPkg.trim() || comp.package;
  comp.quantity = parsed;
  saveToStorage();
  render();
}

// --- Form submit handler ---
compForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = nameInput.value.trim();
  const pkg = pkgInput.value.trim(); // ✅ read package
  const qty = parseInt(qtyInput.value);
  const file = fileInput.files[0];

  if (!name) {
    alert('Please enter a component name.');
    return;
  }
  if (Number.isNaN(qty) || qty <= 0) {
    alert('Quantity must be a positive integer.');
    return;
  }

  let imageData = null;
  try {
    imageData = await resizeImageFile(file, MAX_IMAGE_SIDE);
  } catch (err) {
    console.error(err);
    alert('Failed to process image. Try another file.');
    return;
  }

  const newComp = {
    id: uid(),
    name,
    package: pkg || '-', // ✅ save package
    quantity: qty,
    image: imageData,
  };

  components.push(newComp);
  saveToStorage();
  render();

  compForm.reset();
  qtyInput.value = 1;
});

// Export to PDF
exportBtn.addEventListener('click', () => {
  if (components.length === 0) {
    alert('No components to export.');
    return;
  }

  const printWrap = document.createElement('div');
  printWrap.style.padding = '18px';
  printWrap.style.background = '#ffffff';
  printWrap.style.color = '#000'; // ✅ Dark black text for visibility
  printWrap.style.fontFamily = 'Poppins, Arial, sans-serif';

  const title = document.createElement('h2');
  title.textContent = 'Component List';
  title.style.margin = '6px 0 18px 0';
  title.style.color = '#000';
  printWrap.appendChild(title);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">#</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Image</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Component Name</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Package</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Quantity</th>
      </tr>
    </thead>
  `;
  const tbodyClone = document.createElement('tbody');

  components.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #eee;color:#000">${idx + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">
        <img src="${c.image || placeholderDataURI()}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1px solid #aaa" />
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#000">${escapeHtml(c.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#000">${escapeHtml(c.package || '-')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#000">${c.quantity}</td>
    `;
    tbodyClone.appendChild(tr);
  });

  table.appendChild(tbodyClone);
  printWrap.appendChild(table);

  const opt = {
    margin: 12,
    filename: 'component_list.pdf',
    image: { type: 'jpeg', quality: 0.9 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(printWrap).save();
});

// Clear all
clearAllBtn.addEventListener('click', () => {
  if (!confirm('Clear all components? This cannot be undone.')) return;
  components = [];
  saveToStorage();
  render();
});

// Helper: escape HTML
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

// Init
loadFromStorage();
render();
