/* ============================================
   PENJUALAN MODULE — Sales Data Entry
   ============================================ */
const Penjualan = (() => {
    let cart = [];

    // --- Initialize ---
    async function init() {
        await loadPembeliDropdown();
        bindEvents();
        document.getElementById('penjTanggal').value = Utils.todayStr();
        await refreshHistory();
        await refreshTarikData();
        await refreshTarikDataDetail();
    }

    // --- Load pembeli dropdown ---
    async function loadPembeliDropdown() {
        const select = document.getElementById('penjPembeli');
        const current = select.value;
        const items = await DB.getMasterByType('pembeli');
        const firstOpt = select.querySelector('option');
        select.innerHTML = '';
        if (firstOpt) select.appendChild(firstOpt);
        items.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
        if (current) select.value = current;

        // Also populate history filter
        const filterSelect = document.getElementById('penjHistoryFilter');
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Semua Pembeli</option>';
        items.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            filterSelect.appendChild(opt);
        });
        if (currentFilter) filterSelect.value = currentFilter;
    }

    // --- Bind events ---
    function bindEvents() {
        document.getElementById('btnPenjAddToCart').addEventListener('click', addToCart);
        document.getElementById('btnPenjClear').addEventListener('click', clearForm);
        document.getElementById('btnPenjSaveAll').addEventListener('click', saveAll);
        document.getElementById('btnPenjExportPdf').addEventListener('click', exportPdf);
        document.getElementById('btnPenjExportStaffExcel').addEventListener('click', exportStaffExcel);
        document.getElementById('penjHistoryFilter').addEventListener('change', refreshHistory);
        document.getElementById('btnPenjHistoryExport').addEventListener('click', exportHistory);
        document.getElementById('btnPenjHistoryPdf').addEventListener('click', exportHistoryPdf);

        // Tarik Data
        document.getElementById('penjTarikFilter').addEventListener('change', refreshTarikData);
        document.getElementById('btnTarikExport').addEventListener('click', exportTarikData);
        document.getElementById('penjTarikDetailFilter').addEventListener('change', refreshTarikDataDetail);
        document.getElementById('btnTarikDetailExport').addEventListener('click', exportTarikDataDetail);

        // Print settings
        const printSettingsBtn = document.getElementById('btnPrintSettings');
        if (printSettingsBtn) {
            printSettingsBtn.addEventListener('click', async () => {
                await loadPrintSettingsModal();
                Utils.openModal('modalPrintSettings');
            });
        }
        document.getElementById('btnSavePrintSettings').addEventListener('click', savePrintSettings);
        document.getElementById('btnClosePrintSettings').addEventListener('click', () => Utils.closeModal('modalPrintSettings'));
        document.getElementById('printLogo').addEventListener('change', handleLogoUpload);

        // RFID lookup
        document.getElementById('penjRfid').addEventListener('change', () => lookupFromInduksi(document.getElementById('penjRfid').value.trim()));

        // Scanner auto-fill
        window.addEventListener('scanner-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pagePenjualan') {
                document.getElementById('penjRfid').value = e.detail.rfid;
                lookupFromInduksi(e.detail.rfid);
            }
        });

        // Scale auto-fill
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pagePenjualan') {
                document.getElementById('penjBerat').value = e.detail.weight;
            }
        });
    }

    // --- Lookup from Induksi ---
    async function lookupFromInduksi(rfid) {
        if (!rfid) return;
        const record = await DB.get('induksi', rfid);
        if (record) {
            document.getElementById('penjEartag').value = record.eartag || '';
            document.getElementById('penjShipment').value = record.shipment || '';
        } else {
            Utils.showToast('RFID tidak ditemukan di data Induksi', 'warning');
        }
    }

    // --- Add to cart ---
    function addToCart() {
        const rfid = document.getElementById('penjRfid').value.trim();
        const pembeli = document.getElementById('penjPembeli').value;
        const tanggal = document.getElementById('penjTanggal').value;
        const eartag = document.getElementById('penjEartag').value;
        const shipment = document.getElementById('penjShipment').value;
        const berat = parseFloat(document.getElementById('penjBerat').value) || 0;

        if (!rfid) { Utils.showToast('RFID wajib diisi', 'warning'); return; }
        if (!pembeli) { Utils.showToast('Pembeli wajib dipilih', 'warning'); return; }

        // Check duplicate in cart
        if (cart.find(c => c.rfid === rfid)) {
            Utils.showToast('RFID sudah ada di keranjang', 'warning');
            return;
        }

        cart.push({ rfid, pembeli, tanggalJual: tanggal, eartag, shipment, berat });
        renderCart();
        clearItemFields();
    }

    // --- Render cart ---
    function renderCart() {
        const tbody = document.getElementById('penjCartBody');
        document.getElementById('cartCount').textContent = cart.length;
        document.getElementById('cartTotal').textContent = Utils.formatNumber(cart.reduce((s, c) => s + c.berat, 0));

        if (cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Keranjang kosong</td></tr>';
            return;
        }

        tbody.innerHTML = cart.map((c, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${c.rfid}</td>
                <td>${c.eartag || '-'}</td>
                <td>${c.shipment || '-'}</td>
                <td>${Utils.formatNumber(c.berat)}</td>
                <td>${c.pembeli}</td>
                <td>${Utils.formatDate(c.tanggalJual)}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="Penjualan.editCartItem(${i})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Penjualan.removeFromCart(${i})">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // --- Remove from cart ---
    function removeFromCart(index) {
        cart.splice(index, 1);
        renderCart();
    }

    // --- Edit cart item ---
    function editCartItem(index) {
        const item = cart[index];
        document.getElementById('penjRfid').value = item.rfid;
        document.getElementById('penjPembeli').value = item.pembeli;
        document.getElementById('penjTanggal').value = item.tanggalJual;
        document.getElementById('penjEartag').value = item.eartag;
        document.getElementById('penjShipment').value = item.shipment;
        document.getElementById('penjBerat').value = item.berat;
        cart.splice(index, 1);
        renderCart();
    }

    // --- Save all cart items to DB ---
    async function saveAll() {
        if (cart.length === 0) { Utils.showToast('Keranjang kosong', 'warning'); return; }
        if (!confirm(`Simpan ${cart.length} data penjualan?`)) return;

        try {
            for (const item of cart) {
                await DB.add('penjualan', item);
            }
            Utils.showToast(`${cart.length} data penjualan berhasil disimpan`, 'success');
            DB.addLog('Penjualan', `Saved ${cart.length} sales`);
            cart = [];
            renderCart();
            clearForm();
            await refreshHistory();
            await refreshTarikData();
            await refreshTarikDataDetail();
        } catch (err) {
            console.error('Penjualan save error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        clearItemFields();
        document.getElementById('penjTanggal').value = Utils.todayStr();
    }

    function clearItemFields() {
        document.getElementById('penjRfid').value = '';
        document.getElementById('penjEartag').value = '';
        document.getElementById('penjShipment').value = '';
        document.getElementById('penjBerat').value = '';
        document.getElementById('penjRfid').focus();
    }

    // --- Get Print Settings ---
    async function getPrintSettings() {
        const settings = await DB.get('settings', 'printSettings');
        return settings ? settings.value : {
            headerText: 'Feedlot Management',
            subHeader: 'Invoice Penjualan Sapi',
            logo: null,
            pageSize: 'a4',
            orientation: 'portrait',
            footerText: 'Terima kasih atas kerja sama Anda'
        };
    }

    // --- Save print settings ---
    async function savePrintSettings() {
        const settings = {
            headerText: document.getElementById('printHeaderText').value,
            subHeader: document.getElementById('printSubHeader').value,
            logo: window._printLogoData || null,
            pageSize: document.getElementById('printPageSize').value,
            orientation: document.getElementById('printOrientation').value,
            footerText: document.getElementById('printFooterText').value
        };
        await DB.add('settings', { key: 'printSettings', value: settings });
        Utils.showToast('Pengaturan cetak berhasil disimpan', 'success');
        Utils.closeModal('modalPrintSettings');
    }

    // --- Handle logo upload ---
    function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            window._printLogoData = evt.target.result;
            Utils.showToast('Logo berhasil di-upload', 'success');
        };
        reader.readAsDataURL(file);
    }

    // --- Load print settings to modal ---
    async function loadPrintSettingsModal() {
        const settings = await getPrintSettings();
        document.getElementById('printHeaderText').value = settings.headerText || '';
        document.getElementById('printSubHeader').value = settings.subHeader || '';
        document.getElementById('printPageSize').value = settings.pageSize || 'a4';
        document.getElementById('printOrientation').value = settings.orientation || 'portrait';
        document.getElementById('printFooterText').value = settings.footerText || '';
        window._printLogoData = settings.logo || null;
    }

    // --- Export PDF Invoice ---
    async function exportPdf() {
        if (cart.length === 0) { Utils.showToast('Keranjang kosong', 'warning'); return; }
        const pembeli = document.getElementById('penjPembeli').value || cart[0].pembeli;
        await generatePdf(cart, pembeli);
    }

    function exportHistoryPdf() {
        const filter = document.getElementById('penjHistoryFilter').value;
        if (!filter) { Utils.showToast('Pilih pembeli terlebih dahulu untuk PDF', 'warning'); return; }
        DB.getAll('penjualan').then(all => {
            const data = all.filter(d => d.pembeli === filter);
            if (data.length > 0) generatePdf(data, filter);
            else Utils.showToast('Tidak ada data untuk pembeli ini', 'warning');
        });
    }

    async function generatePdf(data, pembeli) {
        const settings = await getPrintSettings();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: settings.orientation, unit: 'mm', format: settings.pageSize });

        let y = 15;
        // Logo
        if (settings.logo) {
            try { doc.addImage(settings.logo, 'PNG', 14, 10, 20, 20); y = 15; } catch (e) { }
        }
        // Header
        doc.setFontSize(16);
        doc.text(settings.headerText || 'Feedlot Management', settings.logo ? 38 : 14, y);
        y += 7;
        doc.setFontSize(11);
        doc.text(settings.subHeader || 'Invoice Penjualan Sapi', settings.logo ? 38 : 14, y);
        y += 7;
        doc.setFontSize(10);
        doc.text(`Pembeli: ${pembeli}`, 14, y);
        doc.text(`Tanggal: ${Utils.formatDate(Utils.todayStr())}`, 140, y);
        y += 5;

        // Table
        const tableData = data.map((d, i) => [
            i + 1, d.rfid, d.eartag || '-', d.shipment || '-',
            Utils.formatNumber(d.berat), Utils.formatDate(d.tanggalJual)
        ]);

        doc.autoTable({
            startY: y,
            head: [['No', 'RFID', 'Eartag', 'Shipment', 'Berat (Kg)', 'Tanggal']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [15, 52, 96] }
        });

        // Totals
        const finalY = doc.lastAutoTable.finalY + 8;
        const totalBerat = data.reduce((s, d) => s + (parseFloat(d.berat) || 0), 0);
        doc.setFontSize(11);
        doc.text(`Total Sapi: ${data.length}`, 14, finalY);
        doc.text(`Total Berat: ${Utils.formatNumber(totalBerat)} Kg`, 14, finalY + 6);

        // Footer
        if (settings.footerText) {
            const pageH = doc.internal.pageSize.getHeight();
            doc.setFontSize(9);
            doc.text(settings.footerText, 14, pageH - 10);
        }

        doc.save(`invoice_${pembeli}_${Utils.todayStr()}.pdf`);
        Utils.showToast('PDF berhasil di-export', 'success');
    }

    // --- Export Staff Excel (with DOF/ADG from Induksi & Reweight) ---
    async function exportStaffExcel() {
        const dataToExport = cart.length > 0 ? cart : [];
        if (dataToExport.length === 0) { Utils.showToast('Keranjang kosong', 'warning'); return; }

        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const induksiMap = {};
        allInduksi.forEach(i => induksiMap[i.rfid] = i);
        const reweightMap = {};
        allReweight.forEach(r => { if (!reweightMap[r.rfid]) reweightMap[r.rfid] = r; });

        const exportData = dataToExport.map((d, i) => {
            const ind = induksiMap[d.rfid] || {};
            const rew = reweightMap[d.rfid] || {};

            const dofInduksi = Utils.calculateDOF(ind.tanggal, d.tanggalJual);
            const adgInduksi = Utils.calculateADG(ind.berat, d.berat, dofInduksi);
            const dofReweight = rew.tanggal ? Utils.calculateDOF(rew.tanggal, d.tanggalJual) : '';
            const adgReweight = rew.tanggal ? Utils.calculateADG(rew.berat, d.berat, dofReweight) : '';

            return {
                'No': i + 1, 'RFID': d.rfid, 'Eartag': d.eartag, 'Shipment': d.shipment,
                'Pembeli': d.pembeli, 'Jenis Sapi': ind.jenisSapi || '',
                'Tgl Induksi': Utils.formatDate(ind.tanggal), 'Berat Ind.': ind.berat || 0,
                'Tgl Reweight': rew.tanggal ? Utils.formatDate(rew.tanggal) : '',
                'Berat Rew.': rew.berat || '',
                'Tgl Jual': Utils.formatDate(d.tanggalJual), 'Berat Jual': d.berat,
                'DOF Induksi': dofInduksi, 'ADG Induksi': adgInduksi,
                'DOF Reweight': dofReweight, 'ADG Reweight': adgReweight
            };
        });
        Utils.exportToExcel(exportData, `staff_penjualan_${Utils.todayStr()}.xlsx`, 'Staff');
    }

    // --- History ---
    async function refreshHistory() {
        const tbody = document.getElementById('penjHistoryBody');
        const filter = document.getElementById('penjHistoryFilter').value;
        let data = await DB.getAll('penjualan');
        if (filter) data = data.filter(d => d.pembeli === filter);

        // Refresh tarik data filter
        await refreshTarikFilter();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada riwayat</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.rfid}</td>
                <td>${d.eartag || '-'}</td>
                <td>${d.shipment || '-'}</td>
                <td>${Utils.formatNumber(d.berat)}</td>
                <td>${d.pembeli || '-'}</td>
                <td>${Utils.formatDate(d.tanggalJual)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Penjualan.deleteHistoryItem(${d.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // --- Delete history item ---
    async function deleteHistoryItem(id) {
        if (!confirm('Hapus data penjualan ini?')) return;
        await DB.remove('penjualan', id);
        Utils.showToast('Data dihapus', 'success');
        DB.addLog('Penjualan', `Deleted sale ID ${id}`);
        await refreshHistory();
        await refreshTarikData();
        await refreshTarikDataDetail();
    }

    // --- Export history ---
    async function exportHistory() {
        const filter = document.getElementById('penjHistoryFilter').value;
        let data = await DB.getAll('penjualan');
        if (filter) data = data.filter(d => d.pembeli === filter);
        const exportData = data.map((d, i) => ({
            'No': i + 1, 'RFID': d.rfid, 'Eartag': d.eartag, 'Shipment': d.shipment,
            'Berat': d.berat, 'Pembeli': d.pembeli, 'Tanggal Jual': Utils.formatDate(d.tanggalJual)
        }));
        Utils.exportToExcel(exportData, `riwayat_penjualan_${Utils.todayStr()}.xlsx`, 'Riwayat');
    }

    // --- Refresh tarik data filter ---
    async function refreshTarikFilter() {
        const selects = ['penjTarikFilter', 'penjTarikDetailFilter'];
        const allInduksi = await DB.getAll('induksi');
        const shipments = [...new Set(allInduksi.map(d => d.shipment).filter(Boolean))].sort();

        for (const selectId of selects) {
            const select = document.getElementById(selectId);
            const current = select.value;
            select.innerHTML = '<option value="">Semua Shipment</option>';
            shipments.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s; opt.textContent = s;
                select.appendChild(opt);
            });
            if (current) select.value = current;
        }
    }

    // ============================================================
    // TARIK DATA — Summary report: Induksi + Reweight + Penjualan
    // ============================================================
    async function refreshTarikData() {
        const tbody = document.getElementById('tarikDataBody');
        const shipFilter = document.getElementById('penjTarikFilter').value;

        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        // Group by shipment
        const shipmentMap = {};
        allInduksi.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) shipmentMap[s] = { indCount: 0, indBerat: 0, rewCount: 0, rewBerat: 0, soldCount: 0, soldBerat: 0 };
            shipmentMap[s].indCount++;
            shipmentMap[s].indBerat += parseFloat(d.berat) || 0;
        });

        allReweight.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) shipmentMap[s] = { indCount: 0, indBerat: 0, rewCount: 0, rewBerat: 0, soldCount: 0, soldBerat: 0 };
            shipmentMap[s].rewCount++;
            shipmentMap[s].rewBerat += parseFloat(d.berat) || 0;
        });

        allPenjualan.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) shipmentMap[s] = { indCount: 0, indBerat: 0, rewCount: 0, rewBerat: 0, soldCount: 0, soldBerat: 0 };
            shipmentMap[s].soldCount++;
            shipmentMap[s].soldBerat += parseFloat(d.berat) || 0;
        });

        const shipments = Object.keys(shipmentMap).sort();
        if (shipments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = shipments.map(s => {
            const d = shipmentMap[s];
            return `<tr>
                <td>${s}</td>
                <td>${d.indCount}</td>
                <td>${Utils.formatNumber(d.indBerat)}</td>
                <td>${d.rewCount}</td>
                <td>${Utils.formatNumber(d.rewBerat)}</td>
                <td>${d.soldCount}</td>
                <td>${Utils.formatNumber(d.soldBerat)}</td>
                <td>${d.indCount - d.soldCount}</td>
            </tr>`;
        }).join('');
    }

    // --- Export Tarik Data ---
    async function exportTarikData() {
        const shipFilter = document.getElementById('penjTarikFilter').value;
        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        const shipmentMap = {};
        allInduksi.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) shipmentMap[s] = { indCount: 0, indBerat: 0, rewCount: 0, rewBerat: 0, soldCount: 0, soldBerat: 0 };
            shipmentMap[s].indCount++;
            shipmentMap[s].indBerat += parseFloat(d.berat) || 0;
        });
        allReweight.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) return;
            shipmentMap[s].rewCount++;
            shipmentMap[s].rewBerat += parseFloat(d.berat) || 0;
        });
        allPenjualan.forEach(d => {
            const s = d.shipment || 'Unknown';
            if (shipFilter && s !== shipFilter) return;
            if (!shipmentMap[s]) return;
            shipmentMap[s].soldCount++;
            shipmentMap[s].soldBerat += parseFloat(d.berat) || 0;
        });

        const exportData = Object.keys(shipmentMap).sort().map(s => ({
            'Shipment': s, 'Jml Induksi': shipmentMap[s].indCount,
            'Total Berat Ind.': shipmentMap[s].indBerat,
            'Jml Reweight': shipmentMap[s].rewCount,
            'Total Berat Rew.': shipmentMap[s].rewBerat,
            'Jml Terjual': shipmentMap[s].soldCount,
            'Total Berat Jual': shipmentMap[s].soldBerat,
            'Sisa Sapi': shipmentMap[s].indCount - shipmentMap[s].soldCount
        }));
        Utils.exportToExcel(exportData, `tarik_data_${Utils.todayStr()}.xlsx`, 'Tarik Data');
    }

    // ============================================================
    // TARIK DATA DETAIL — Per Eartag Report
    // ============================================================
    async function refreshTarikDataDetail() {
        const tbody = document.getElementById('tarikDataDetailBody');
        const shipFilter = document.getElementById('penjTarikDetailFilter').value;

        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        // Build lookup maps
        const reweightMap = {};
        allReweight.forEach(r => { if (!reweightMap[r.rfid]) reweightMap[r.rfid] = r; });
        const penjualanMap = {};
        allPenjualan.forEach(p => { if (!penjualanMap[p.rfid]) penjualanMap[p.rfid] = p; });

        let data = allInduksi;
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((ind, i) => {
            const rew = reweightMap[ind.rfid] || {};
            const penj = penjualanMap[ind.rfid] || {};

            const dofIndRew = rew.tanggal ? Utils.calculateDOF(ind.tanggal, rew.tanggal) : '';
            const dofIndJual = penj.tanggalJual ? Utils.calculateDOF(ind.tanggal, penj.tanggalJual) : '';
            const dofRewJual = (rew.tanggal && penj.tanggalJual) ? Utils.calculateDOF(rew.tanggal, penj.tanggalJual) : '';
            const adgIndRew = rew.tanggal ? Utils.calculateADG(ind.berat, rew.berat, dofIndRew) : '';
            const adgIndJual = penj.tanggalJual ? Utils.calculateADG(ind.berat, penj.berat, dofIndJual) : '';
            const adgRewJual = (rew.tanggal && penj.tanggalJual) ? Utils.calculateADG(rew.berat, penj.berat, dofRewJual) : '';

            return `<tr>
                <td>${i + 1}</td>
                <td>${ind.rfid}</td>
                <td>${ind.eartag || '-'}</td>
                <td>${ind.shipment || '-'}</td>
                <td>${penj.pembeli || '-'}</td>
                <td>${ind.jenisSapi || '-'}</td>
                <td>${Utils.formatDate(ind.tanggal)}</td>
                <td>${Utils.formatNumber(ind.berat)}</td>
                <td>${rew.tanggal ? Utils.formatDate(rew.tanggal) : '-'}</td>
                <td>${rew.berat ? Utils.formatNumber(rew.berat) : '-'}</td>
                <td>${penj.tanggalJual ? Utils.formatDate(penj.tanggalJual) : '-'}</td>
                <td>${penj.berat ? Utils.formatNumber(penj.berat) : '-'}</td>
                <td>${dofIndRew !== '' ? dofIndRew : '-'}</td>
                <td>${dofIndJual !== '' ? dofIndJual : '-'}</td>
                <td>${dofRewJual !== '' ? dofRewJual : '-'}</td>
                <td>${adgIndRew !== '' ? Utils.formatNumber(adgIndRew, 2) : '-'}</td>
                <td>${adgIndJual !== '' ? Utils.formatNumber(adgIndJual, 2) : '-'}</td>
                <td>${adgRewJual !== '' ? Utils.formatNumber(adgRewJual, 2) : '-'}</td>
            </tr>`;
        }).join('');
    }

    async function exportTarikDataDetail() {
        const shipFilter = document.getElementById('penjTarikDetailFilter').value;
        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        const reweightMap = {};
        allReweight.forEach(r => { if (!reweightMap[r.rfid]) reweightMap[r.rfid] = r; });
        const penjualanMap = {};
        allPenjualan.forEach(p => { if (!penjualanMap[p.rfid]) penjualanMap[p.rfid] = p; });

        let data = allInduksi;
        if (shipFilter) data = data.filter(d => d.shipment === shipFilter);

        const exportData = data.map((ind, i) => {
            const rew = reweightMap[ind.rfid] || {};
            const penj = penjualanMap[ind.rfid] || {};

            const dofIndRew = rew.tanggal ? Utils.calculateDOF(ind.tanggal, rew.tanggal) : '';
            const dofIndJual = penj.tanggalJual ? Utils.calculateDOF(ind.tanggal, penj.tanggalJual) : '';
            const dofRewJual = (rew.tanggal && penj.tanggalJual) ? Utils.calculateDOF(rew.tanggal, penj.tanggalJual) : '';
            const adgIndRew = rew.tanggal ? Utils.calculateADG(ind.berat, rew.berat, dofIndRew) : '';
            const adgIndJual = penj.tanggalJual ? Utils.calculateADG(ind.berat, penj.berat, dofIndJual) : '';
            const adgRewJual = (rew.tanggal && penj.tanggalJual) ? Utils.calculateADG(rew.berat, penj.berat, dofRewJual) : '';

            return {
                'No': i + 1, 'RFID': ind.rfid, 'Eartag': ind.eartag, 'Shipment': ind.shipment,
                'Pembeli': penj.pembeli || '', 'Jenis Sapi': ind.jenisSapi || '',
                'Tgl Induksi': Utils.formatDate(ind.tanggal), 'Berat Ind.': ind.berat || 0,
                'Tgl Reweight': rew.tanggal ? Utils.formatDate(rew.tanggal) : '',
                'Berat Rew.': rew.berat || '',
                'Tgl Jual': penj.tanggalJual ? Utils.formatDate(penj.tanggalJual) : '',
                'Berat Jual': penj.berat || '',
                'DOF Ind-Rew': dofIndRew, 'DOF Ind-Jual': dofIndJual, 'DOF Rew-Jual': dofRewJual,
                'ADG Ind-Rew': adgIndRew, 'ADG Ind-Jual': adgIndJual, 'ADG Rew-Jual': adgRewJual
            };
        });
        Utils.exportToExcel(exportData, `tarik_data_detail_${Utils.todayStr()}.xlsx`, 'Detail');
    }

    return {
        init, loadPembeliDropdown, removeFromCart, editCartItem,
        deleteHistoryItem, refreshHistory, refreshTarikData, refreshTarikDataDetail,
        loadPrintSettingsModal
    };
})();
