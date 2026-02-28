/* ============================================
   REWEIGHT MODULE — Reweight Data Entry
   ============================================ */
const Reweight = (() => {
    const TEMPLATE_HEADERS = ['RFID', 'Tanggal', 'BeratReweight', 'PenAwal', 'PenAkhir', 'Vitamin'];

    // --- Initialize ---
    async function init() {
        bindEvents();
        document.getElementById('rewTanggal').value = Utils.todayStr();
        await refreshTableFilter();
        await refreshTable();
        await refreshSummaryAwal();
        await refreshSummaryAkhir();
        await refreshDetail();
        await refreshSummaryJenis();
    }

    // --- Bind events ---
    function bindEvents() {
        document.getElementById('btnReweightInput').addEventListener('click', saveData);
        document.getElementById('btnReweightClear').addEventListener('click', clearForm);
        document.getElementById('btnRewExportExcel').addEventListener('click', exportExcel);
        document.getElementById('btnRewImportExcel').addEventListener('click', () => document.getElementById('rewImportFile').click());
        document.getElementById('rewImportFile').addEventListener('change', (e) => { importExcel(e); e.target.value = ''; });
        document.getElementById('btnRewDownloadTemplate').addEventListener('click', downloadTemplate);
        document.getElementById('btnRewDeleteSelected').addEventListener('click', deleteSelected);
        document.getElementById('rewCheckAll').addEventListener('change', (e) => {
            document.querySelectorAll('#rewTableBody input[type=checkbox]').forEach(cb => cb.checked = e.target.checked);
        });
        document.getElementById('rewTableFilter').addEventListener('change', () => { refreshTable(); refreshTableFilter(); });
        document.getElementById('rewTableFilterPen').addEventListener('change', refreshTable);

        // Summary tabs
        document.getElementById('btnSummaryAwal').addEventListener('click', () => {
            document.getElementById('btnSummaryAwal').classList.add('active');
            document.getElementById('btnSummaryAkhir').classList.remove('active');
            document.getElementById('rewSummaryAwalSection').classList.remove('hidden');
            document.getElementById('rewSummaryAkhirSection').classList.add('hidden');
        });
        document.getElementById('btnSummaryAkhir').addEventListener('click', () => {
            document.getElementById('btnSummaryAkhir').classList.add('active');
            document.getElementById('btnSummaryAwal').classList.remove('active');
            document.getElementById('rewSummaryAkhirSection').classList.remove('hidden');
            document.getElementById('rewSummaryAwalSection').classList.add('hidden');
        });

        // Summary filters
        document.getElementById('rewSummaryAwalFilter').addEventListener('change', refreshSummaryAwal);
        document.getElementById('btnRewSummaryAwalExport').addEventListener('click', exportSummaryAwal);
        document.getElementById('rewSummaryAkhirFilter').addEventListener('change', refreshSummaryAkhir);
        document.getElementById('btnRewSummaryAkhirExport').addEventListener('click', exportSummaryAkhir);

        // Detail report
        document.getElementById('rewDetailFilter').addEventListener('change', refreshDetail);
        document.getElementById('btnRewDetailExport').addEventListener('click', exportDetail);

        // Summary Jenis Sapi
        document.getElementById('rewSummaryJenisFilter').addEventListener('change', refreshSummaryJenis);
        document.getElementById('btnRewSummaryJenisExport').addEventListener('click', exportSummaryJenis);

        // RFID lookup on change/blur
        document.getElementById('rewRfid').addEventListener('change', () => lookupInduksi(document.getElementById('rewRfid').value.trim()));

        // Auto-calculate DOF/ADG when weight changes
        document.getElementById('rewBerat').addEventListener('input', calculateDofAdg);
        document.getElementById('rewTanggal').addEventListener('change', calculateDofAdg);

        // Scanner auto-fill
        window.addEventListener('scanner-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageReweight') {
                document.getElementById('rewRfid').value = e.detail.rfid;
                lookupInduksi(e.detail.rfid);
            }
        });

        // Scale auto-fill
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageReweight') {
                document.getElementById('rewBerat').value = e.detail.weight;
                calculateDofAdg();
            }
        });
    }

    // --- Lookup Induksi data by RFID ---
    async function lookupInduksi(rfid) {
        if (!rfid) return;
        const record = await DB.get('induksi', rfid);
        if (record) {
            document.getElementById('rewTglInduksi').value = record.tanggal || '';
            document.getElementById('rewEartag').value = record.eartag || '';
            document.getElementById('rewShipment').value = record.shipment || '';
            document.getElementById('rewBeratInduksi').value = record.berat || 0;
            document.getElementById('rewPenInduksi').value = record.pen || '';
            document.getElementById('rewFrame').value = record.frame || '';
            document.getElementById('rewJenisSapi').value = record.jenisSapi || '';
            calculateDofAdg();
        } else {
            Utils.showToast('RFID tidak ditemukan di data Induksi', 'warning');
        }
    }

    // --- Calculate DOF and ADG ---
    function calculateDofAdg() {
        const tglInduksi = document.getElementById('rewTglInduksi').value;
        const tglReweight = document.getElementById('rewTanggal').value;
        const beratInduksi = parseFloat(document.getElementById('rewBeratInduksi').value) || 0;
        const beratReweight = parseFloat(document.getElementById('rewBerat').value) || 0;

        const dof = Utils.calculateDOF(tglInduksi, tglReweight);
        const adg = Utils.calculateADG(beratInduksi, beratReweight, dof);

        document.getElementById('rewDof').value = dof;
        document.getElementById('rewAdg').value = adg;
    }

    // --- Save Data ---
    async function saveData() {
        const rfid = document.getElementById('rewRfid').value.trim();
        if (!rfid) { Utils.showToast('RFID wajib diisi', 'warning'); return; }

        const data = {
            rfid,
            tglInduksi: document.getElementById('rewTglInduksi').value,
            tanggal: document.getElementById('rewTanggal').value,
            eartag: document.getElementById('rewEartag').value,
            shipment: document.getElementById('rewShipment').value,
            berat: parseFloat(document.getElementById('rewBerat').value) || 0,
            beratInduksi: parseFloat(document.getElementById('rewBeratInduksi').value) || 0,
            penInduksi: document.getElementById('rewPenInduksi').value,
            penAwal: document.getElementById('rewPenAwal').value.trim(),
            penAkhir: document.getElementById('rewPenAkhir').value.trim(),
            dof: parseInt(document.getElementById('rewDof').value) || 0,
            adg: parseFloat(document.getElementById('rewAdg').value) || 0,
            frame: document.getElementById('rewFrame').value,
            vitamin: parseInt(document.getElementById('rewVitamin').value) || 1,
            jenisSapi: document.getElementById('rewJenisSapi').value
        };

        try {
            await DB.add('reweight', data);
            Utils.showToast('Data reweight berhasil disimpan', 'success');
            DB.addLog('Reweight', `Added RFID ${data.rfid}`);
            clearForm();
            await refreshTable();
            await refreshSummaryAwal();
            await refreshSummaryAkhir();
            await refreshDetail();
            await refreshSummaryJenis();
            await refreshTableFilter();
        } catch (err) {
            console.error('Reweight save error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        ['rewRfid', 'rewTglInduksi', 'rewEartag', 'rewShipment', 'rewBeratInduksi', 'rewPenInduksi', 'rewPenAwal', 'rewPenAkhir', 'rewDof', 'rewAdg', 'rewFrame', 'rewJenisSapi'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('rewBerat').value = '';
        document.getElementById('rewVitamin').value = '1';
        document.getElementById('rewTanggal').value = Utils.todayStr();
        document.getElementById('rewRfid').focus();
    }

    // --- Refresh Table (with sold cattle filter + shipment filter + PEN Akhir filter) ---
    async function refreshTable() {
        const tbody = document.getElementById('rewTableBody');
        const shipFilter = document.getElementById('rewTableFilter').value;
        const penFilter = document.getElementById('rewTableFilterPen').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);
        if (penFilter) data = data.filter(d => d.penAkhir === penFilter);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="17" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((d, i) => `
            <tr>
                <td class="checkbox-col"><input type="checkbox" data-id="${d.id}"></td>
                <td>${i + 1}</td>
                <td>${d.rfid}</td>
                <td>${Utils.formatDate(d.tglInduksi)}</td>
                <td>${Utils.formatDate(d.tanggal)}</td>
                <td>${d.eartag || '-'}</td>
                <td>${d.shipment || '-'}</td>
                <td>${Utils.formatNumber(d.berat)}</td>
                <td>${d.penInduksi || '-'}</td>
                <td>${d.penAwal || '-'}</td>
                <td><span class="editable-pen" onclick="Reweight.handleEditPenAkhir(this)" data-id="${d.id}">${d.penAkhir || '-'}</span></td>
                <td>${d.dof || 0}</td>
                <td>${Utils.formatNumber(d.adg, 2)}</td>
                <td>${d.frame || '-'}</td>
                <td>${d.vitamin || 1}</td>
                <td>${d.jenisSapi || '-'}</td>
            </tr>
        `).join('');
    }

    // --- Edit PEN Akhir inline ---
    function handleEditPenAkhir(span) {
        const id = parseInt(span.dataset.id);
        const currentVal = span.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal === '-' ? '' : currentVal;
        input.className = 'form-control';
        input.style.cssText = 'width:80px;padding:2px 4px;font-size:0.82rem;';

        const save = async () => {
            const newVal = input.value.trim();
            if (newVal !== currentVal) {
                const record = await DB.get('reweight', id);
                if (record) {
                    record.penAkhir = newVal;
                    await DB.update('reweight', record);
                    DB.addLog('Reweight', `PEN Akhir changed for ID ${id}: ${currentVal} → ${newVal}`);
                }
            }
            await refreshTable();
            await refreshSummaryAkhir();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        span.replaceWith(input);
        input.focus();
        input.select();
    }

    // --- Delete selected ---
    async function deleteSelected() {
        const checked = document.querySelectorAll('#rewTableBody input[type=checkbox]:checked');
        if (checked.length === 0) { Utils.showToast('Pilih data yang ingin dihapus', 'warning'); return; }
        if (!confirm(`Hapus ${checked.length} data?`)) return;
        for (const cb of checked) {
            await DB.remove('reweight', parseInt(cb.dataset.id));
        }
        Utils.showToast(`${checked.length} data dihapus`, 'success');
        DB.addLog('Reweight', `Deleted ${checked.length} records`);
        await refreshTable();
        await refreshSummaryAwal();
        await refreshSummaryAkhir();
        await refreshDetail();
        await refreshSummaryJenis();
    }

    // --- Export/Import/Template ---
    async function exportExcel() {
        const shipFilter = document.getElementById('rewTableFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const exportData = data.map((d, i) => ({
            'No': i + 1, 'RFID': d.rfid, 'Tgl Induksi': Utils.formatDate(d.tglInduksi),
            'Tgl Reweight': Utils.formatDate(d.tanggal), 'Eartag': d.eartag,
            'Shipment': d.shipment, 'Berat': d.berat, 'PEN Induksi': d.penInduksi,
            'PEN Awal': d.penAwal, 'PEN Akhir': d.penAkhir,
            'DOF': d.dof, 'ADG': d.adg, 'Frame': d.frame,
            'Vitamin': d.vitamin, 'Jenis Sapi': d.jenisSapi
        }));
        Utils.exportToExcel(exportData, `reweight_${Utils.todayStr()}.xlsx`, 'Reweight');
    }

    async function importExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const rows = await Utils.readExcel(file);
            if (rows.length === 0) { Utils.showToast('File kosong', 'warning'); return; }
            let count = 0;
            for (const row of rows) {
                const rfid = String(row.RFID || row.rfid || '').trim();
                if (!rfid) continue;

                // Lookup induksi for auto-fill
                const induksi = await DB.get('induksi', rfid);
                const tglInduksi = induksi ? induksi.tanggal : '';
                const beratInduksi = induksi ? (parseFloat(induksi.berat) || 0) : 0;
                const tanggal = row.Tanggal || row.tanggal || Utils.todayStr();
                const berat = parseFloat(row.BeratReweight || row.beratReweight || row.Berat || row.berat) || 0;
                const dof = Utils.calculateDOF(tglInduksi, tanggal);
                const adg = Utils.calculateADG(beratInduksi, berat, dof);

                const data = {
                    rfid,
                    tglInduksi,
                    tanggal,
                    eartag: induksi ? induksi.eartag : '',
                    shipment: induksi ? induksi.shipment : '',
                    berat,
                    beratInduksi,
                    penInduksi: induksi ? induksi.pen : '',
                    penAwal: String(row.PenAwal || row.penAwal || '').trim(),
                    penAkhir: String(row.PenAkhir || row.penAkhir || '').trim(),
                    dof, adg,
                    frame: induksi ? induksi.frame : '',
                    vitamin: parseInt(row.Vitamin || row.vitamin) || 1,
                    jenisSapi: induksi ? induksi.jenisSapi : ''
                };
                await DB.add('reweight', data);
                count++;
            }
            Utils.showToast(`${count} data berhasil di-import`, 'success');
            DB.addLog('Reweight', `Imported ${count} records from Excel`);
            await refreshTable();
            await refreshSummaryAwal();
            await refreshSummaryAkhir();
            await refreshDetail();
            await refreshSummaryJenis();
        } catch (err) {
            Utils.showToast('Gagal import: ' + err.message, 'error');
        }
    }

    function downloadTemplate() {
        Utils.downloadTemplate(TEMPLATE_HEADERS, 'template_reweight.xlsx');
    }

    // --- Refresh table filter dropdown ---
    async function refreshTableFilter() {
        const select = document.getElementById('rewTableFilter');
        const penSelect = document.getElementById('rewTableFilterPen');
        const currentShip = select.value;
        const currentPen = penSelect.value;

        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));

        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
        });
        if (currentShip) select.value = currentShip;

        let filtered = data;
        if (currentShip) filtered = filtered.filter(d => d.shipment === currentShip);
        const pens = [...new Set(filtered.map(d => d.penAkhir).filter(Boolean))].sort();
        penSelect.innerHTML = '<option value="">Semua PEN Akhir</option>';
        pens.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            penSelect.appendChild(opt);
        });
        if (currentPen) penSelect.value = currentPen;

        // Also refresh summary filters
        await refreshSummaryFilter('rewSummaryAwalFilter');
        await refreshSummaryFilter('rewSummaryAkhirFilter');
        await refreshSummaryFilter('rewDetailFilter');
        await refreshSummaryFilter('rewSummaryJenisFilter');
    }

    // --- Summary PEN Awal ---
    async function refreshSummaryAwal() {
        const tbody = document.getElementById('rewSummaryAwalBody');
        const shipFilter = document.getElementById('rewSummaryAwalFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.penAwal || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, totalAdg: 0, jenis: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            penMap[pen].totalAdg += parseFloat(d.adg) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
        });

        const pens = Object.keys(penMap).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = pens.map(pen => {
            const p = penMap[pen];
            return `<tr>
                <td>${pen}</td>
                <td>${p.count}</td>
                <td>${Utils.formatNumber(p.totalBerat)}</td>
                <td>${Utils.formatNumber(p.count > 0 ? p.totalBerat / p.count : 0)}</td>
                <td>${Utils.formatNumber(p.count > 0 ? p.totalAdg / p.count : 0, 2)}</td>
                <td>${[...p.jenis].join(', ') || '-'}</td>
            </tr>`;
        }).join('');
    }

    // --- Summary PEN Akhir ---
    async function refreshSummaryAkhir() {
        const tbody = document.getElementById('rewSummaryAkhirBody');
        const shipFilter = document.getElementById('rewSummaryAkhirFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.penAkhir || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, totalAdg: 0, jenis: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            penMap[pen].totalAdg += parseFloat(d.adg) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
        });

        const pens = Object.keys(penMap).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = pens.map(pen => {
            const p = penMap[pen];
            return `<tr>
                <td>${pen}</td>
                <td>${p.count}</td>
                <td>${Utils.formatNumber(p.totalBerat)}</td>
                <td>${Utils.formatNumber(p.count > 0 ? p.totalBerat / p.count : 0)}</td>
                <td>${Utils.formatNumber(p.count > 0 ? p.totalAdg / p.count : 0, 2)}</td>
                <td>${[...p.jenis].join(', ') || '-'}</td>
            </tr>`;
        }).join('');
    }

    // --- Refresh summary filter dropdown ---
    async function refreshSummaryFilter(selectId) {
        const select = document.getElementById(selectId);
        const current = select.value;
        const data = await DB.getAll('reweight');
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    }

    // --- Detail Report (per Eartag) ---
    async function refreshDetail() {
        const tbody = document.getElementById('rewDetailBody');
        const shipFilter = document.getElementById('rewDetailFilter').value;
        let rewData = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        rewData = rewData.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) rewData = rewData.filter(d => d.shipment === shipFilter);

        if (rewData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = rewData.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.shipment || '-'}</td>
                <td>${d.rfid}</td>
                <td>${d.eartag || '-'}</td>
                <td>${Utils.formatDate(d.tglInduksi)}</td>
                <td>${Utils.formatNumber(d.beratInduksi || 0)}</td>
                <td>${Utils.formatDate(d.tanggal)}</td>
                <td>${Utils.formatNumber(d.berat)}</td>
                <td>${d.dof || 0}</td>
                <td>${Utils.formatNumber(d.adg || 0, 2)}</td>
                <td>${d.jenisSapi || '-'}</td>
            </tr>
        `).join('');
    }

    // --- Export Detail ---
    async function exportDetail() {
        const shipFilter = document.getElementById('rewDetailFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const exportData = data.map((d, i) => ({
            'No': i + 1, 'Shipment': d.shipment, 'RFID': d.rfid, 'Eartag': d.eartag,
            'Tgl Induksi': Utils.formatDate(d.tglInduksi), 'Berat Ind.': d.beratInduksi || 0,
            'Tgl Reweight': Utils.formatDate(d.tanggal), 'Berat Rew.': d.berat,
            'DOF Ind-Rew': d.dof || 0, 'ADG Ind-Rew': d.adg || 0, 'Jenis Sapi': d.jenisSapi
        }));
        Utils.exportToExcel(exportData, `reweight_detail_${Utils.todayStr()}.xlsx`, 'Detail');
    }

    // --- Summary per Jenis Sapi ---
    async function refreshSummaryJenis() {
        const tbody = document.getElementById('rewSummaryJenisBody');
        const shipFilter = document.getElementById('rewSummaryJenisFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const jenisMap = {};
        data.forEach(d => {
            const jenis = d.jenisSapi || 'Tidak diketahui';
            if (!jenisMap[jenis]) jenisMap[jenis] = { total: 0, inputted: 0, totalBerat: 0, totalAdg: 0 };
            jenisMap[jenis].total++;
            if (d.berat && parseFloat(d.berat) > 0) {
                jenisMap[jenis].inputted++;
                jenisMap[jenis].totalBerat += parseFloat(d.berat);
                jenisMap[jenis].totalAdg += parseFloat(d.adg) || 0;
            }
        });

        const types = Object.keys(jenisMap).sort();
        if (types.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = types.map(jenis => {
            const j = jenisMap[jenis];
            return `<tr>
                <td>${jenis}</td>
                <td>${j.total}</td>
                <td>${Utils.formatNumber(j.totalBerat)}</td>
                <td>${Utils.formatNumber(j.inputted > 0 ? j.totalBerat / j.inputted : 0)}</td>
                <td>${Utils.formatNumber(j.inputted > 0 ? j.totalAdg / j.inputted : 0, 2)}</td>
            </tr>`;
        }).join('');
    }

    // --- Export summaries ---
    async function exportSummaryAwal() {
        const shipFilter = document.getElementById('rewSummaryAwalFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.penAwal || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, totalAdg: 0, jenis: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            penMap[pen].totalAdg += parseFloat(d.adg) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
        });

        const exportData = Object.keys(penMap).sort().map(pen => ({
            'PEN Awal': pen, 'Jumlah': penMap[pen].count,
            'Total Berat': penMap[pen].totalBerat,
            'Avg Berat': penMap[pen].count > 0 ? parseFloat((penMap[pen].totalBerat / penMap[pen].count).toFixed(1)) : 0,
            'Avg ADG': penMap[pen].count > 0 ? parseFloat((penMap[pen].totalAdg / penMap[pen].count).toFixed(2)) : 0,
            'Jenis Sapi': [...penMap[pen].jenis].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_reweight_pen_awal_${Utils.todayStr()}.xlsx`, 'PEN Awal');
    }

    async function exportSummaryAkhir() {
        const shipFilter = document.getElementById('rewSummaryAkhirFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const penMap = {};
        data.forEach(d => {
            const pen = d.penAkhir || 'Tanpa PEN';
            if (!penMap[pen]) penMap[pen] = { count: 0, totalBerat: 0, totalAdg: 0, jenis: new Set() };
            penMap[pen].count++;
            penMap[pen].totalBerat += parseFloat(d.berat) || 0;
            penMap[pen].totalAdg += parseFloat(d.adg) || 0;
            if (d.jenisSapi) penMap[pen].jenis.add(d.jenisSapi);
        });

        const exportData = Object.keys(penMap).sort().map(pen => ({
            'PEN Akhir': pen, 'Jumlah': penMap[pen].count,
            'Total Berat': penMap[pen].totalBerat,
            'Avg Berat': penMap[pen].count > 0 ? parseFloat((penMap[pen].totalBerat / penMap[pen].count).toFixed(1)) : 0,
            'Avg ADG': penMap[pen].count > 0 ? parseFloat((penMap[pen].totalAdg / penMap[pen].count).toFixed(2)) : 0,
            'Jenis Sapi': [...penMap[pen].jenis].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_reweight_pen_akhir_${Utils.todayStr()}.xlsx`, 'PEN Akhir');
    }

    async function exportSummaryJenis() {
        const shipFilter = document.getElementById('rewSummaryJenisFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const jenisMap = {};
        data.forEach(d => {
            const jenis = d.jenisSapi || 'Tidak diketahui';
            if (!jenisMap[jenis]) jenisMap[jenis] = { total: 0, inputted: 0, totalBerat: 0, totalAdg: 0 };
            jenisMap[jenis].total++;
            if (d.berat && parseFloat(d.berat) > 0) {
                jenisMap[jenis].inputted++;
                jenisMap[jenis].totalBerat += parseFloat(d.berat);
                jenisMap[jenis].totalAdg += parseFloat(d.adg) || 0;
            }
        });

        const exportData = Object.keys(jenisMap).sort().map(jenis => ({
            'Jenis Sapi': jenis, 'Jumlah': jenisMap[jenis].total,
            'Total Berat': jenisMap[jenis].totalBerat,
            'Avg Berat': jenisMap[jenis].inputted > 0 ? parseFloat((jenisMap[jenis].totalBerat / jenisMap[jenis].inputted).toFixed(1)) : 0,
            'Avg ADG': jenisMap[jenis].inputted > 0 ? parseFloat((jenisMap[jenis].totalAdg / jenisMap[jenis].inputted).toFixed(2)) : 0,
        }));
        Utils.exportToExcel(exportData, `summary_reweight_jenis_${Utils.todayStr()}.xlsx`, 'Jenis Sapi');
    }

    return { init, refreshTable, refreshSummaryAwal, refreshSummaryAkhir, refreshDetail, refreshSummaryJenis, refreshTableFilter, handleEditPenAkhir };
})();
