import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { ToastStack } from '@/components/ui/Toast';
import BillTemplate from '@/print/BillTemplate';
import EmergencyBillTemplate from '@/print/EmergencyBillTemplate';
import EmergencyBill from '@/pages/EmergencyBill';
import EmergencyBillHistory from '@/pages/EmergencyBillHistory';
import BillHistory from '@/pages/BillHistory';
import Dashboard from '@/pages/Dashboard';
import Inventory from '@/pages/Inventory';
import NewBill from '@/pages/NewBill';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import QuickBill from '@/pages/QuickBill';
import QuickBillHistory from '@/pages/QuickBillHistory';
import StockTimeline from '@/pages/StockTimeline';

function useHashRoute() {
  const getRoute = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return [route, (next) => (window.location.hash = `/${next}`)];
}

export default function App() {
  const [route, setRoute] = useHashRoute();
  const [pageState, setPageState] = useState({});
  const [dashboardSummary, setDashboardSummary] = useState({
    todaysSales: 0,
    billsGeneratedToday: 0,
    lowStockItems: 0,
    expiringSoonItems: 0,
    expiredItems: 0,
    recentBills: [],
  });
  const [toasts, setToasts] = useState([]);
  const [printBill, setPrintBill] = useState(null);
  const [persistentBill, setPersistentBill] = useState(null);
  const [shopSettings, setShopSettings] = useState(null);
  const [backingUp, setBackingUp] = useState(false);

  const isPrintRoute = route.startsWith('print/');
  const printParts = isPrintRoute ? route.split('/') : [];
  const isEmergencyPrint = printParts[1] === 'emergency';
  const printBillId = isPrintRoute ? (isEmergencyPrint ? printParts[2] : printParts[1]) : null;

  function toast(message, type = 'success') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 2800);
  }

  async function loadDashboard() {
    setDashboardSummary(await window.api.bills.getDashboardSummary());
  }

  useEffect(() => {
    if (!isPrintRoute) {
      loadDashboard();
      window.api.settings.get().then(setShopSettings);
    }
  }, [isPrintRoute]);

  useEffect(() => {
    if (!printBillId) return;
    if (printBillId === 'raw') {
      const checkData = () => {
        if (window.__PRINT_DATA__) {
          setPrintBill(window.__PRINT_DATA__);
        } else {
          setTimeout(checkData, 100);
        }
      };
      checkData();
    } else if (isEmergencyPrint) {
      window.api.emergencyBills.getById(Number(printBillId)).then(setPrintBill);
    } else {
      window.api.bills.getById(Number(printBillId)).then(setPrintBill);
    }
  }, [printBillId, isEmergencyPrint]);

  function navigate(page, state = {}) {
    setPageState(state);
    setRoute(page);
  }

  async function handleCloudBackup() {
    setBackingUp(true);
    try {
      const result = await window.api.backup.toSpacetime();
      if (result?.success) {
        const { counts } = result;
        toast(
          `Backup saved to SpacetimeDB (${counts.medicines} medicines, ${counts.bills} bills, ${counts.emergency_bills} emergency bills)`,
        );
      } else {
        toast(result?.message || 'Backup failed', 'error');
      }
    } catch (error) {
      toast(error?.message || 'Backup failed', 'error');
    } finally {
      setBackingUp(false);
    }
  }

  const content = useMemo(() => {
    if (route === 'dashboard') {
      return <Dashboard summary={dashboardSummary} onNavigate={navigate} onReprint={(id) => window.api.bills.print(id)} />;
    }
    if (route === 'new-bill') {
      return (
        <NewBill
          toast={toast}
          onBillSaved={loadDashboard}
          persistentBill={persistentBill}
          setPersistentBill={setPersistentBill}
          shopSettings={shopSettings}
          editBillId={pageState.editBillId || null}
          onNavigate={navigate}
        />
      );
    }
    if (route === 'inventory') {
      return <Inventory toast={toast} initialFilter={pageState.filter || 'all'} />;
    }
    if (route === 'bill-history') {
      return <BillHistory toast={toast} onNavigate={navigate} />;
    }
    if (route === 'reports') {
      return <Reports />;
    }
    if (route === 'settings') {
      return <Settings toast={toast} />;
    }
    if (route === 'quick-bill') {
      return (
        <QuickBill
          toast={toast}
          shopSettings={shopSettings}
          editBillId={pageState.editBillId || null}
          onNavigate={navigate}
        />
      );
    }
    if (route === 'quick-history') {
      return <QuickBillHistory toast={toast} onNavigate={navigate} />;
    }
    if (route === 'emergency-bill') {
      return (
        <EmergencyBill
          toast={toast}
          shopSettings={shopSettings}
          editBillId={pageState.editBillId || null}
          onNavigate={navigate}
        />
      );
    }
    if (route === 'emergency-history') {
      return <EmergencyBillHistory toast={toast} onNavigate={navigate} />;
    }
    if (route === 'stock-timeline') {
      return <StockTimeline toast={toast} />;
    }
    return <Dashboard summary={dashboardSummary} onNavigate={navigate} onReprint={(id) => window.api.bills.print(id)} />;
  }, [dashboardSummary, pageState.filter, pageState.editBillId, route, persistentBill, shopSettings]);

  if (isPrintRoute) {
    const isEmergencyBill =
      isEmergencyPrint || printBill?.bill_type === 'emergency';
    return (
      <div className={isEmergencyBill ? 'print-page emergency-print-page' : 'print-page'}>
        {printBill
          ? isEmergencyBill
            ? <EmergencyBillTemplate bill={printBill} />
            : <BillTemplate bill={printBill} />
          : null}
      </div>
    );
  }

  return (
    <>
      <div className="app-shell min-h-screen bg-content">
        <Sidebar />
        <div className="ml-[24px] min-h-screen">
          <Header
            page={route}
            onNavigate={navigate}
            onBackup={handleCloudBackup}
            backingUp={backingUp}
          />
          <main className="p-8">{content}</main>
        </div>
      </div>
      <ToastStack toasts={toasts} />
    </>
  );
}
