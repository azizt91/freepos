import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Search, Receipt as ReceiptIcon, Calendar, ChevronRight, ShoppingBag, CalendarIcon, X, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ReceiptDialog from '@/components/Receipt';
import { toast } from 'sonner';

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreStock, setRestoreStock] = useState(true);

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );

  // Query all transaction items and build lookup map
  const txItemsMap = useLiveQuery(async () => {
    const items = await db.transactionItems.toArray();
    const map: Record<number, TransactionItemRecord[]> = {};
    for (const item of items) {
      if (!map[item.transactionId]) map[item.transactionId] = [];
      map[item.transactionId].push(item);
    }
    return map;
  });

  const getTxItems = (txId: number | undefined): TransactionItemRecord[] =>
    txId ? (txItemsMap?.[txId] ?? []) : [];
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  // Auto-open detail if txId is in URL
  const txIdParam = searchParams.get('txId');
  useEffect(() => {
    if (txIdParam && transactions) {
      const tx = transactions.find(t => t.id === Number(txIdParam) || t.receiptNumber === txIdParam);
      if (tx) {
        setSelectedTx(tx);
        setDetailOpen(true);
      }
    }
  }, [txIdParam, transactions]);

  const getPaymentName = (pmId: number) =>
    paymentMethods?.find(pm => pm.id === pmId)?.name || 'Tunai';

  const filtered = transactions?.filter(tx => {
    // Date filter
    if (dateFrom) {
      const txDate = new Date(tx.date);
      if (txDate < startOfDay(dateFrom)) return false;
    }
    if (dateTo) {
      const txDate = new Date(tx.date);
      if (txDate > endOfDay(dateTo)) return false;
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const items = getTxItems(tx.id);
      return (
        tx.receiptNumber.toLowerCase().includes(q) ||
        items.some(it => it.productName.toLowerCase().includes(q))
      );
    }
    return true;
  }) ?? [];

  // Group by date
  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const filteredTotal = filtered.reduce((s, t) => s + t.total, 0);
  const hasDateFilter = dateFrom || dateTo;

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const openReceipt = () => {
    setDetailOpen(false);
    setTimeout(() => setReceiptOpen(true), 200);
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleCancelTransaction = async () => {
    if (!selectedTx?.id) return;
    try {
      if (restoreStock) {
        const items = getTxItems(selectedTx.id);
        for (const item of items) {
          if (item.variantId) {
            const variant = await db.productVariants.get(item.variantId);
            if (variant) {
              await db.productVariants.update(item.variantId, { stock: variant.stock + item.quantity });
            }
          } else {
            const product = await db.products.get(item.productId);
            if (product) {
              await db.products.update(item.productId, { stock: product.stock + item.quantity });
            }
          }
        }
      }
      
      await db.transactions.update(selectedTx.id, {
        isCanceled: 1,
        canceledAt: new Date()
      });

      setDeleteDialogOpen(false);
      setDetailOpen(false);
      setSelectedTx(null);
      toast.success('Transaksi berhasil dibatalkan');
    } catch {
      toast.error('Gagal membatalkan transaksi');
    }
  };

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ReceiptIcon className="w-5 h-5 text-primary" />
          Riwayat Transaksi
        </h1>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari no. struk atau nama produk..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 flex-1", dateFrom && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: localeId }) : 'Dari tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">—</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 flex-1", dateTo && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: localeId }) : 'Sampai tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hasDateFilter && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={clearDateFilter}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Transaksi</p>
              <p className="text-lg font-bold text-primary">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Penjualan</p>
              <p className="text-lg font-bold text-primary">{rp(filteredTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {dateKeys.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasDateFilter ? 'Tidak ada transaksi di rentang tanggal ini' : 'Belum ada transaksi'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateKeys.map(dateKey => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                </p>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {grouped[dateKey].length} transaksi
                </Badge>
              </div>
              <div className="space-y-2">
                {grouped[dateKey].map(tx => (
                  <Card
                    key={tx.id ?? tx.receiptNumber}
                    className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                    onClick={() => openDetail(tx)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <ReceiptIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-muted-foreground truncate">{tx.receiptNumber}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.date), 'HH:mm')}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold ${tx.isCanceled ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                            {rp(tx.total)}
                          </p>
                          {tx.isCanceled === 1 && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1">Dibatalkan</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {getTxItems(tx.id).map(it => it.productName).join(', ')}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Detail Transaksi</SheetTitle>
          </SheetHeader>
          {selectedTx && (
            <div className="mt-4 space-y-4 overflow-y-auto pb-6">
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">No. Struk</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{selectedTx.receiptNumber}</span>
                    {selectedTx.isCanceled === 1 && <Badge variant="destructive" className="text-[9px] h-4">DIBATALKAN</Badge>}
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{format(new Date(selectedTx.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}</span>
                </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">Pembayaran</span>
                   <span>{getPaymentName(selectedTx.paymentMethodId)}</span>
                 </div>
                 {selectedTx.remarks && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">Catatan</span>
                     <span className="text-right max-w-[60%]">{selectedTx.remarks}</span>
                   </div>
                 )}
               </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Item</p>
                {getTxItems(selectedTx.id).map((item, i) => (
                  <div key={i} className="flex justify-between items-start bg-muted/30 p-2.5 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} × {rp(item.price)}
                        {item.discountAmount > 0 && ` (diskon ${rp(item.discountAmount)})`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{rp(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{rp(selectedTx.subtotal)}</span>
                </div>
                {selectedTx.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Diskon</span>
                    <span>-{rp(selectedTx.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">{rp(selectedTx.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bayar</span>
                  <span>{rp(selectedTx.paymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kembali</span>
                  <span className="text-success font-medium">{rp(selectedTx.change)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="text-success font-medium">{rp(selectedTx.profit)}</span>
                </div>
              </div>

              <Button className="w-full h-11" onClick={openReceipt}>
                <ReceiptIcon className="w-4 h-4 mr-2" />
                Lihat & Cetak Struk
              </Button>

              {!selectedTx.isCanceled && (
                <Button
                  variant="outline"
                  className="w-full h-11 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => { setRestoreStock(true); setDeleteDialogOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Batalkan Transaksi
                </Button>
              )}
              {selectedTx.isCanceled === 1 && (
                <div className="bg-destructive/5 border border-destructive/20 p-3 rounded-xl">
                  <p className="text-[10px] text-destructive font-semibold text-center uppercase tracking-wider">
                    Transaksi ini telah dibatalkan pada {selectedTx.canceledAt && format(new Date(selectedTx.canceledAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Receipt reprint */}
      {selectedTx && (
        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={selectedTx}
          items={getTxItems(selectedTx.id)}
          storeSettings={storeSettings}
          paymentMethodName={getPaymentName(selectedTx.paymentMethodId)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Transaksi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Transaksi <span className="font-mono font-semibold">{selectedTx?.receiptNumber}</span> senilai <span className="font-semibold text-primary">Rp {selectedTx?.total.toLocaleString('id-ID')}</span> akan dibatalkan.</p>
                <p className="text-xs text-muted-foreground">Tindakan ini tidak dapat diubah kembali di masa depan.</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="restore-stock"
                    checked={restoreStock}
                    onCheckedChange={(checked) => setRestoreStock(checked === true)}
                  />
                  <label htmlFor="restore-stock" className="text-sm cursor-pointer">
                    Kembalikan stok produk
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
