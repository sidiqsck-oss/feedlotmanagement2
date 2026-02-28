/* ============================================
   INDUKSI MODULE — Induction Data Entry
   ============================================ */
const Induksi = (() => {
    const TEMPLATE_HEADERS = ['Shipment', 'RFID', 'Tanggal', 'Eartag', 'Berat', 'PEN', 'Gigi', 'Frame', 'KodeProperty', 'Vitamin', 'JenisSapi'];

    // --- Initialize ---
    async function init() {
        await loadDropdowns();
        bindEvents();
        document.getElementById('indTanggal').value = Utils.todayStr();
        await refreshTableFilter();
        await refreshTable();
        await refreshSummary();
        await refreshSummaryJenis();
    }

    // --- Load dropdown options from master_data ---
    async function loadDropdowns() {
        await loadSelect('indShipment', 'shipment');
        await loadSelect('indFrame', 'frame');
        await loadSelect('indKodeProperty', 'kodeProperty');
        await loadSelect('indJenisSapi', 'jenisSapi');
    }

    async function loadSelect(selectId, type) {
        const select = document.getElementById(selectId);
        const current = select.value;
        const items = await DB.getMasterByType(type);
        // Keep first option
        const firstOpt = select.querySelector('option');
        select.innerHTML = '';
        if (firstOpt) select.appendChild(firstOpt);
        items.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
        // Restore or auto-select last
        if (current && items.includes(current)) {
            select.value = current;
        } else if (items.length > 0) {
            select.value = items[items.length - 1];
        }
    }

    // --- Bind events ---
    function bindEvents() {
        document.getElementById('btnInduksiInput').addEventListener('click', saveData);
        document.getElementById('btnInduksiClear').addEventListener('click', clearForm);
        document.getElementById('btnIndExportExcel').addEventListener('click', exportExcel);
        document.getElementById('btnIndImportExcel').addEventListener('click', () => document.getElementById('indImportFile').click());
        document.getElementById('indImportFile').addEventListener('change', (e) => { importExcel(e); e.target.value = ''; });
        document.getElementById('btnIndDownloadTemplate').addEventListener('click', downloadTemplate);
        document.getElementById('btnIndDeleteSelected').addEventListener('click', deleteSelected);
        document.getElementById('indCheckAll').addEventListener('change', (e) => {
            document.querySelectorAll('#indTableBody input[type=checkbox]').forEach(cb => cb.checked = e.target.checked);
        });
        document.getElementById('indTableFilter').addEventListener('change', () => { refreshTable(); refreshTableFilter(); });
        document.getElementById('indTableFilterPen').addEventListener('change', refreshTable);
        document.getElementById('indSummaryFilter').addEventListener('change', refreshSummary);
        document.getElementById('btnIndSummaryExport').addEventListener('click', exportSummary);
        document.getElementById('indSummaryJenisFilter').addEventListener('change', refreshSummaryJenis);
        document.getElementById('btnIndSummaryJenisExport').addEventListener('click', exportSummaryJenis);

        // Scanner auto-fill RFID
        window.addEventListener('scanner-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageInduksi') {
                document.getElementById('indRfid').value = e.detail.rfid;
            }
        });

        // Scale auto-fill weight
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageInduksi') {
                document.getElementById('indBerat').value = e.detail.weight;
            }
        });
    }

    // --- Save Data ---
    async function saveData() {
        const data = {
            rfid: document.getElementById('indRfid').value.trim(),
            shipment: document.getElementById('indShipment').value,
            tanggal: document.getElementById('indTanggal').value,
            eartag: document.getElementById('indEartag').value.trim(),
            berat: parseFloat(document.getElementById('indBerat').value) || 0,
            pen: document.getElementById('indPen').value.trim(),
            gigi: document.getElementById('indGigi').value,
            frame: document.getElementById('indFrame').value,
            kodeProperty: document.getElementById('indKodeProperty').value,
            vitamin: parseInt(document.getElementById('indVitamin').value) || 1,
            jenisSapi: document.getElementById('indJenisSapi').value
        };

        if (!data.rfid) { Utils.showToast('RFID wajib diisi', 'warning'); return; }
        if (!data.shipment) { Utils.showToast('Shipment wajib dipilih', 'warning'); return; }

        try {
            await DB.add('induksi', data);
            Utils.showToast('Data induksi berhasil disimpan', 'success');
            DB.addLog('Induksi', `Added RFID ${data.rfid}`);
            clearForm();
            await refreshTable();
            await refreshSummary();
            await refreshSummaryJenis();
            await refreshTableFilter();
            await refreshSummaryFilter();
        } catch (err) {
            console.error('Induksi save error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        document.getElementById('indRfid').value = '';
        document.getElementById('indEartag').value = '';
        document.getElementById('indBerat').value = '';
        document.getElementById('indPen').value = '';
        document.getElementById('indGigi').value = '0';
        document.getElementById('indVitamin').value = '1';
        document.getElementById('indRfid').focus();
    }

    // --- Refresh Table (with shipment filter & sold filter & PEN filter) ---
    async function refreshTable() {
        const tbody = document.getElementById('indTableBody');
        const shipFilter = document.getElementById('indTableFilter').value;
        const penFilter = document.getElementById('indTableFilterPen').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();

        // Filter out sold cattle
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);
        if (penFilter) data = data.filter(d => d.pen === penFilter);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((d, i) => `
            <tr>
                <td class="checkbox-col"><input type="checkbox" data-rfid="${d.rfid}"></td>
                <td>${i + 1}</td>
                <td>${d.shipment || '-'}</td>
                <td>${d.rfid}</td>
                <td>${Utils.formatDate(d.tanggal)}</td>
                <td>${d.eartag || '-'}</td>
                <td>${Utils.formatNumber(d.berat)}</td>
                <td><span class="editable-pen" onclick="Induksi.handleEditPen(this)" data-rfid="${d.rfid}">${d.pen || '-'}</span></td>
                <td>${d.gigi || '0'}</td>
                <td>${d.frame || '-'}</td>
                <td>${d.kodeProperty || '-'}</td>
                <td>${d.vitamin || 1}</td>
                <td>${d.jenisSapi || '-'}</td>
            </tr>
        `).join('');
    }

    // --- Edit PEN inline (for changing temp pen to fixed pen) ---
    function handleEditPen(span) {
        const rfid = span.dataset.rfid;
        const currentVal = span.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal === '-' ? '' : currentVal;
        input.className = 'form-control';
        input.style.cssText = 'width:80px;padding:2px 4px;font-size:0.82rem;';

        const save = async () => {
            const newVal = input.value.trim();
            if (newVal !== currentVal) {
                const record = await DB.get('induksi', rfid);
                if (record) {
                    record.pen = newVal;
                    await DB.update('induksi', record);
                    DB.addLog('Induksi', `PEN changed for ${rfid}: ${currentVal} → ${newVal}`);
                }
            }
            await refreshTable();
            await refreshSummary();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        span.replaceWith(input);
        input.focus();
        input.select();
    }

    // --- Delete selected ---
    async function deleteSelected() {
        const checked = document.querySelectorAll('#indTableBody input[type=checkbox]:checked');
        if (checked.length === 0) { Utils.showToast('Pilih data yang ingin dihapus', 'warning'); return; }
        if (!confirm(`Hapus ${checked.length} data?`)) return;
        for (const cb of checked) {
            await DB.remove('induksi', cb.dataset.rfid);
        }
        Utils.showToast(`${checked.length} data dihapus`, 'success');
        DB.addLog('Induksi', `Deleted ${checked.length} records`);
        await refreshTable();
        await refreshSummary();
        await refreshSummaryJenis();
        await refreshTableFilter();
    }

    // --- Export Excel ---
    async function exportExcel() {
        const shipFilter = document.getElementById('indTableFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const exportData = data.map((d, i) => ({
            'No': i + 1,
            'Shipment': d.shipment,
            'RFID': d.rfid,
            'Tanggal': Utils.formatDate(d.tanggal),
            'Eartag': d.eartag,
            'Berat': d.berat,
            'PEN': d.pen,
            'Gigi': d.gigi,
            'Frame': d.frame,
            'Kode Property': d.kodeProperty,
            'Vitamin': d.vitamin,
            'Jenis Sapi': d.jenisSapi
        }));
        Utils.exportToExcel(exportData, `induksi_${Utils.todayStr()}.xlsx`, 'Induksi');
    }

    // --- Import Excel ---
    async function importExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const rows = await Utils.readExcel(file);
            if (rows.length === 0) { Utils.showToast('File kosong', 'warning'); return; }
            let count = 0;
            for (const row of rows) {
                const data = {
                    rfid: String(row.RFID || row.rfid || '').trim(),
                    shipment: String(row.Shipment || row.shipment || '').trim(),
                    tanggal: row.Tanggal || row.tanggal || Utils.todayStr(),
                    eartag: String(row.Eartag || row.eartag || '').trim(),
                    berat: parseFloat(row.Berat || row.berat) || 0,
                    pen: String(row.PEN || row.pen || '').trim(),
                    gigi: String(row.Gigi || row.gigi || '0'),
                    frame: String(row.Frame || row.frame || '').trim(),
                    kodeProperty: String(row.KodeProperty || row.kodeProperty || '').trim(),
                    vitamin: parseInt(row.Vitamin || row.vitamin) || 1,
                    jenisSapi: String(row.JenisSapi || row.jenisSapi || '').trim()
                };
                if (data.rfid) {
                    await DB.add('induksi', data);
                    count++;
                }
            }
            Utils.showToast(`${count} data berhasil di-import`, 'success');
            DB.addLog('Induksi', `Imported ${count} records from Excel`);
            await refreshTable();
            await refreshSummary();
            await refreshSummaryJenis();
            await refreshTableFilter();
        } catch (err) {
            Utils.showToast('Gagal import: ' + err.message, 'error');
        }
    }

    // --- Download Template ---
    function downloadTemplate() {
        Utils.downloadTemplate(TEMPLATE_HEADERS, 'template_induksi.xlsx');
    }

    // --- Summary per PEN ---
    async function refreshSummary() {
        const tbody = document.getElementById('indSummaryBody');
        const shipFilter = document.getElementById('indSummaryFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.pen || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, jenis: new Set(), frames: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
            if (d.frame) penMap[pen].frames.add(d.frame);
        });

        const pens = Object.keys(penMap).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = pens.map(pen => {
            const p = penMap[pen];
            const avg = p.count > 0 ? (p.totalBerat / p.count) : 0;
            return `<tr>
                <td>${pen}</td>
                <td>${p.count}</td>
                <td>${Utils.formatNumber(p.totalBerat)}</td>
                <td>${Utils.formatNumber(avg)}</td>
                <td>${[...p.jenis].join(', ') || '-'}</td>
                <td>${[...p.frames].join(', ') || '-'}</td>
            </tr>`;
        }).join('');
    }

    // --- Summary per Jenis Sapi ---
    async function refreshSummaryJenis() {
        const tbody = document.getElementById('indSummaryJenisBody');
        const shipFilter = document.getElementById('indSummaryJenisFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const jenisMap = {};
        data.forEach(d => {
            const jenis = d.jenisSapi || 'Tidak diketahui';
            if (!jenisMap[jenis]) jenisMap[jenis] = { total: 0, inputted: 0, totalBerat: 0 };
            jenisMap[jenis].total++;
            if (d.berat && parseFloat(d.berat) > 0) {
                jenisMap[jenis].inputted++;
                jenisMap[jenis].totalBerat += parseFloat(d.berat);
            }
        });

        const types = Object.keys(jenisMap).sort();
        if (types.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = types.map(jenis => {
            const j = jenisMap[jenis];
            const avg = j.inputted > 0 ? (j.totalBerat / j.inputted) : 0;
            return `<tr>
                <td>${jenis}</td>
                <td>${j.total}</td>
                <td>${Utils.formatNumber(j.totalBerat)}</td>
                <td>${Utils.formatNumber(avg)}</td>
            </tr>`;
        }).join('');
    }

    // --- Refresh summary filter dropdown ---
    async function refreshSummaryFilter() {
        await refreshFilterDropdown('indSummaryFilter');
        await refreshFilterDropdown('indSummaryJenisFilter');
    }

    async function refreshFilterDropdown(selectId) {
        const select = document.getElementById(selectId);
        const current = select.value;
        const data = await DB.getAll('induksi');
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    }

    // --- Refresh table filter dropdown ---
    async function refreshTableFilter() {
        const select = document.getElementById('indTableFilter');
        const penSelect = document.getElementById('indTableFilterPen');
        const currentShip = select.value;
        const currentPen = penSelect.value;

        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));

        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (currentShip) select.value = currentShip;

        // PEN filter based on current shipment filter
        let filtered = data;
        if (currentShip) filtered = filtered.filter(d => d.shipment === currentShip);
        const pens = [...new Set(filtered.map(d => d.pen).filter(Boolean))].sort();
        penSelect.innerHTML = '<option value="">Semua PEN</option>';
        pens.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            penSelect.appendChild(opt);
        });
        if (currentPen) penSelect.value = currentPen;

        // Also refresh summary filter
        await refreshSummaryFilter();
    }

    // --- Export Summary PEN ---
    async function exportSummary() {
        const shipFilter = document.getElementById('indSummaryFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.pen || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, jenis: new Set(), frames: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
            if (d.frame) penMap[pen].frames.add(d.frame);
        });

        const exportData = Object.keys(penMap).sort().map(pen => ({
            'PEN': pen,
            'Jumlah Sapi': penMap[pen].count,
            'Total Berat': penMap[pen].totalBerat,
            'Avg Berat': penMap[pen].count > 0 ? parseFloat((penMap[pen].totalBerat / penMap[pen].count).toFixed(1)) : 0,
            'Jenis Sapi': [...penMap[pen].jenis].join(', '),
            'Frame': [...penMap[pen].frames].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_induksi_pen_${Utils.todayStr()}.xlsx`, 'Summary PEN');
    }

    // --- Export Summary Jenis Sapi ---
    async function exportSummaryJenis() {
        const shipFilter = document.getElementById('indSummaryJenisFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const jenisMap = {};
        data.forEach(d => {
            const jenis = d.jenisSapi || 'Tidak diketahui';
            if (!jenisMap[jenis]) jenisMap[jenis] = { total: 0, inputted: 0, totalBerat: 0 };
            jenisMap[jenis].total++;
            if (d.berat && parseFloat(d.berat) > 0) {
                jenisMap[jenis].inputted++;
                jenisMap[jenis].totalBerat += parseFloat(d.berat);
            }
        });

        const exportData = Object.keys(jenisMap).sort().map(jenis => ({
            'Jenis Sapi': jenis,
            'Jumlah Sapi': jenisMap[jenis].total,
            'Total Berat': jenisMap[jenis].totalBerat,
            'Avg Berat': jenisMap[jenis].inputted > 0 ? parseFloat((jenisMap[jenis].totalBerat / jenisMap[jenis].inputted).toFixed(1)) : 0,
        }));
        Utils.exportToExcel(exportData, `summary_induksi_jenis_${Utils.todayStr()}.xlsx`, 'Summary Jenis');
    }

    return { init, loadDropdowns, refreshTable, refreshSummary, refreshSummaryJenis, refreshSummaryFilter, refreshTableFilter, handleEditPen };
})();
