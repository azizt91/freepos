import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TransactionItemRecord } from '@/lib/db';
import { useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown, FileText } from 'lucide-react';

export default function Laporan() {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const days = Number(period);

  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const transactions = useLiveQuery(async () => {
    const since = startOfDay(subDays(new Date(), days));
    return db.transactions.where('date').aboveOrEqual(since).filter(t => t.isCanceled !== 1).toArray();
  }, [days]);

  // Query transaction items for the filtered transactions
  const txItems = useLiveQuery(async () => {
    if (!transactions || transactions.length === 0) return [];
    const txIds = transactions.map(t => t.id!).filter(Boolean);
    return db.transactionItems.where('transactionId').anyOf(txIds).toArray();
  }, [transactions]);

  const allItems = txItems ?? [];

  const totalSales = transactions?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalProfit = transactions?.reduce((s, t) => s + t.profit, 0) ?? 0;
  const txCount = transactions?.length ?? 0;

  // P&L breakdown
  const totalRevenue = transactions?.reduce((s, t) => s + t.subtotal, 0) ?? 0;
  const totalDiscount = transactions?.reduce((s, t) => s + t.discountAmount, 0) ?? 0;
  const totalHpp = allItems.reduce((s, item) => s + item.hpp * item.quantity, 0);
  const netSales = totalRevenue - totalDiscount; // same as totalSales
  const grossProfit = netSales - totalHpp;
  const marginPercent = netSales > 0 ? (grossProfit / netSales * 100) : 0;

  // Chart data
  const chartData = (() => {
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map[d] = 0;
    }
    transactions?.forEach(t => {
      const d = format(new Date(t.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += t.total;
    });
    return Object.entries(map).map(([date, sales]) => ({ date, sales }));
  })();

  // Top products
  const productSales: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
  allItems.forEach(item => {
    if (!productSales[item.productName]) productSales[item.productName] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
    productSales[item.productName].qty += item.quantity;
    productSales[item.productName].revenue += item.subtotal;
    productSales[item.productName].profit += (item.price - item.hpp) * item.quantity - item.discountAmount;
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const exportToExcel = async () => {
    if (!transactions || transactions.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    try {
      const exportData = transactions.map(t => ({
        'Tanggal': format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
        'No. Struk': t.receiptNumber,
        'Subtotal': t.subtotal,
        'Diskon (%)': t.discountType === 'percentage' ? t.discountValue : 0,
        'Diskon (Nominal)': t.discountAmount,
        'Total': t.total,
        'Profit': t.profit,
        'Metode Pembayaran': paymentMethods?.find(pm => pm.id === t.paymentMethodId)?.name || 'Tunai',
        'Catatan': t.remarks || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');

      // Add item details sheet
      if (txItems && txItems.length > 0) {
        const itemData = txItems.map(item => ({
          'Tanggal': format(new Date(transactions.find(t => t.id === item.transactionId)?.date || new Date()), 'dd/MM/yyyy HH:mm'),
          'No. Struk': transactions.find(t => t.id === item.transactionId)?.receiptNumber || '-',
          'Nama Produk': item.productName,
          'Qty': item.quantity,
          'Harga Jual': item.price,
          'Modal (HPP)': item.hpp,
          'Diskon': item.discountAmount,
          'Subtotal': item.subtotal
        }));
        const wsItems = XLSX.utils.json_to_sheet(itemData);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Produk');
      }

      const fileName = `Laporan_Penjualan_${period}_Hari_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Laporan berhasil diexport ke Excel');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengeksport data');
    }
  };

  const exportToPDF = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    try {
      const doc = new jsPDF();
      const storeName = storeSettings?.storeName || 'FreePOS';
      const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');

      // Title
      doc.setFontSize(18);
      doc.text(storeName, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Laporan Penjualan (${period} Hari Terakhir)`, 14, 30);
      doc.text(`Dicetak pada: ${dateStr}`, 14, 36);

      // Summary
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text('Ringkasan:', 14, 48);
      doc.setFontSize(10);
      doc.text(`Total Transaksi: ${txCount}`, 14, 55);
      doc.text(`Total Penjualan: ${rp(totalSales)}`, 14, 61);
      doc.text(`Total Profit: ${rp(totalProfit)}`, 14, 67);

      // Table
      const tableData = transactions.map(t => [
        format(new Date(t.date), 'dd/MM/yy HH:mm'),
        t.receiptNumber,
        paymentMethods?.find(pm => pm.id === t.paymentMethodId)?.name || 'Tunai',
        t.total.toLocaleString('id-ID'),
        t.profit.toLocaleString('id-ID')
      ]);

      autoTable(doc, {
        startY: 75,
        head: [['Tanggal', 'No. Struk', 'Metode', 'Total (Rp)', 'Profit (Rp)']],
        body: tableData,
        headStyles: { fillColor: [25, 95, 53] }, // Matches primary color
      });

      doc.save(`Laporan_Penjualan_${period}_Hari_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('Laporan PDF berhasil diunduh');
    } catch (err) {
      console.error('PDF Export error:', err);
      toast.error('Gagal membuat PDF');
    }
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Laporan
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel} title="Export Excel" className="h-9 px-2 border-primary/20 text-primary hover:bg-primary/5">
            <FileDown className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} title="Export PDF" className="h-9 px-2 border-success/20 text-success hover:bg-success/5">
            <FileText className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={period} onValueChange={v => setPeriod(v as '7' | '30')}>
        <TabsList className="w-full">
          <TabsTrigger value="7" className="flex-1">7 Hari</TabsTrigger>
          <TabsTrigger value="30" className="flex-1">30 Hari</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{txCount}</p>
            <p className="text-[10px] text-muted-foreground">Transaksi</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-sm font-bold">{rp(totalSales)}</p>
            <p className="text-[10px] text-muted-foreground">Penjualan</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-sm font-bold">{rp(totalProfit)}</p>
            <p className="text-[10px] text-muted-foreground">Profit</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit & Loss */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Laba Rugi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-success" />
              <span>Pendapatan Kotor</span>
            </div>
            <span className="font-semibold">{rp(totalRevenue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <Minus className="w-3.5 h-3.5" />
                <span>Diskon</span>
              </div>
              <span className="font-semibold">-{rp(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-medium">Penjualan Bersih</span>
            <span className="font-bold">{rp(netSales)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>HPP (Modal)</span>
            </div>
            <span className="font-semibold">-{rp(totalHpp)}</span>
          </div>
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">Laba Kotor</span>
            <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {rp(grossProfit)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Margin</span>
            <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tren Penjualan</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => [`Rp ${v.toLocaleString('id-ID')}`, 'Penjualan']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="sales" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Produk Terlaris
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data penjualan</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{rp(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.qty} terjual · laba {rp(p.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
