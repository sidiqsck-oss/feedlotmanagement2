/* ============================================
   DASHBOARD MODULE — Sales Dashboard
   ============================================ */
const Dashboard = (() => {

    async function init() {
        await refresh();
    }

    async function refresh() {
        await refreshSisaSapi();
        await refreshAvgADG();
        await refreshPenjualanBulanan();
        await refreshPerformaCustomer();
    }

    // --- 1. Sisa Sapi per Shipment per Jenis Sapi ---
    async function refreshSisaSapi() {
        const tbody = document.getElementById('dashSisaSapiBody');
        const allInduksi = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();

        const map = {};
        allInduksi.forEach(d => {
            if (soldRfids.has(d.rfid)) return;
            const key = `${d.shipment || 'Unknown'}|||${d.jenisSapi || 'Unknown'}`;
            if (!map[key]) map[key] = { shipment: d.shipment || 'Unknown', jenis: d.jenisSapi || 'Unknown', count: 0, totalBerat: 0 };
            map[key].count++;
            map[key].totalBerat += parseFloat(d.berat) || 0;
        });

        const rows = Object.values(map).sort((a, b) => a.shipment.localeCompare(b.shipment) || a.jenis.localeCompare(b.jenis));
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada data</td></tr>';
            return;
        }

        const totalSapi = rows.reduce((s, r) => s + r.count, 0);
        updateStatCard('statSisaSapi', totalSapi);

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${r.shipment}</td>
                <td>${r.jenis}</td>
                <td>${r.count}</td>
                <td>${Utils.formatNumber(r.totalBerat)}</td>
            </tr>
        `).join('');
    }

    // --- 2. Average ADG per Shipment per Jenis Sapi ---
    async function refreshAvgADG() {
        const tbody = document.getElementById('dashAvgADGBody');
        const allInduksi = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        const today = Utils.todayStr();

        const map = {};
        allInduksi.forEach(d => {
            if (soldRfids.has(d.rfid)) return;
            const key = `${d.shipment || 'Unknown'}|||${d.jenisSapi || 'Unknown'}`;
            if (!map[key]) map[key] = { shipment: d.shipment || 'Unknown', jenis: d.jenisSapi || 'Unknown', count: 0, totalDof: 0 };
            const dof = Utils.calculateDOF(d.tanggal, today);
            map[key].count++;
            map[key].totalDof += dof;
        });

        // Get latest weight from reweight or induksi
        const allReweight = await DB.getAll('reweight');
        const reweightMap = {};
        allReweight.forEach(r => { reweightMap[r.rfid] = r; });

        // Recalculate with ADG
        const map2 = {};
        allInduksi.forEach(d => {
            if (soldRfids.has(d.rfid)) return;
            const key = `${d.shipment || 'Unknown'}|||${d.jenisSapi || 'Unknown'}`;
            if (!map2[key]) map2[key] = { shipment: d.shipment || 'Unknown', jenis: d.jenisSapi || 'Unknown', count: 0, totalAdg: 0 };

            const rew = reweightMap[d.rfid];
            let adg = 0;
            if (rew) {
                const dof = Utils.calculateDOF(d.tanggal, rew.tanggal);
                adg = Utils.calculateADG(d.berat, rew.berat, dof);
            }
            map2[key].count++;
            map2[key].totalAdg += adg;
        });

        const rows = Object.values(map2).sort((a, b) => a.shipment.localeCompare(b.shipment) || a.jenis.localeCompare(b.jenis));
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada data</td></tr>';
            return;
        }

        const totalAvg = rows.reduce((s, r) => s + (r.count > 0 ? r.totalAdg / r.count : 0), 0) / rows.length;
        updateStatCard('statAvgADG', Utils.formatNumber(totalAvg, 2));

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${r.shipment}</td>
                <td>${r.jenis}</td>
                <td>${r.count}</td>
                <td>${Utils.formatNumber(r.count > 0 ? r.totalAdg / r.count : 0, 2)}</td>
            </tr>
        `).join('');
    }

    // --- 3. Penjualan per Bulan ---
    async function refreshPenjualanBulanan() {
        const tbody = document.getElementById('dashPenjualanBulBody');
        const allPenjualan = await DB.getAll('penjualan');

        const map = {};
        allPenjualan.forEach(d => {
            const date = d.tanggalJual ? d.tanggalJual.substring(0, 7) : 'Unknown'; // YYYY-MM
            if (!map[date]) map[date] = { count: 0, totalBerat: 0 };
            map[date].count++;
            map[date].totalBerat += parseFloat(d.berat) || 0;
        });

        const months = Object.keys(map).sort().reverse();
        if (months.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Tidak ada data</td></tr>';
            updateStatCard('statPenjBulan', '0');
            return;
        }

        // Current month stats
        const currentMonth = Utils.todayStr().substring(0, 7);
        const currentData = map[currentMonth] || { count: 0, totalBerat: 0 };
        updateStatCard('statPenjBulan', currentData.count);

        tbody.innerHTML = months.map(m => `
            <tr>
                <td>${m}</td>
                <td>${map[m].count}</td>
                <td>${Utils.formatNumber(map[m].totalBerat)}</td>
            </tr>
        `).join('');
    }

    // --- 4. Performa Customer per Bulan per Tahun ---
    async function refreshPerformaCustomer() {
        const tbody = document.getElementById('dashCustomerBody');
        const allPenjualan = await DB.getAll('penjualan');

        const map = {};
        allPenjualan.forEach(d => {
            const pembeli = d.pembeli || 'Unknown';
            const month = d.tanggalJual ? d.tanggalJual.substring(0, 7) : 'Unknown';
            const key = `${pembeli}|||${month}`;
            if (!map[key]) map[key] = { pembeli, month, count: 0, totalBerat: 0 };
            map[key].count++;
            map[key].totalBerat += parseFloat(d.berat) || 0;
        });

        const rows = Object.values(map).sort((a, b) => b.month.localeCompare(a.month) || a.pembeli.localeCompare(b.pembeli));
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada data</td></tr>';
            updateStatCard('statCustomer', '0');
            return;
        }

        const uniqueCustomers = new Set(rows.map(r => r.pembeli));
        updateStatCard('statCustomer', uniqueCustomers.size);

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${r.pembeli}</td>
                <td>${r.month}</td>
                <td>${r.count}</td>
                <td>${Utils.formatNumber(r.totalBerat)}</td>
            </tr>
        `).join('');
    }

    // --- Update stat card value ---
    function updateStatCard(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    return { init, refresh };
})();
