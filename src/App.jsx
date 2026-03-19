import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { ToastStack } from '@/components/ui/Toast';
import BillTemplate from '@/print/BillTemplate';
import BillHistory from '@/pages/BillHistory';
import Dashboard from '@/pages/Dashboard';
import Inventory from '@/pages/Inventory';
import NewBill from '@/pages/NewBill';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

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

  const isPrintRoute = route.startsWith('print/');
  const printBillId = isPrintRoute ? route.split('/')[1] : null;

  function toast(message, type = 'success') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 2800);
  }

  async function loadDashboard() {
    setDashboardSummary(await window.api.bills.getDashboardSummary());
  }

  useEffect(() => {
    if (!isPrintRoute) loadDashboard();
  }, [isPrintRoute]);

  useEffect(() => {
    if (!printBillId) return;
    window.api.bills.getById(Number(printBillId)).then(setPrintBill);
  }, [printBillId]);

  function navigate(page, state = {}) {
    setPageState(state);
    setRoute(page);
  }

  const content = useMemo(() => {
    if (route === 'dashboard') {
      return <Dashboard summary={dashboardSummary} onNavigate={navigate} onReprint={(id) => window.api.bills.print(id)} />;
    }
    if (route === 'new-bill') {
      return <NewBill toast={toast} onBillSaved={loadDashboard} />;
    }
    if (route === 'inventory') {
      return <Inventory toast={toast} initialFilter={pageState.filter || 'all'} />;
    }
    if (route === 'bill-history') {
      return <BillHistory toast={toast} />;
    }
    if (route === 'reports') {
      return <Reports />;
    }
    if (route === 'settings') {
      return <Settings toast={toast} />;
    }
    return <Dashboard summary={dashboardSummary} onNavigate={navigate} onReprint={(id) => window.api.bills.print(id)} />;
  }, [dashboardSummary, pageState.filter, route]);

  if (isPrintRoute) {
    return <div className="print-page">{printBill ? <BillTemplate bill={printBill} /> : null}</div>;
  }

  return (
    <>
      <div className="app-shell min-h-screen bg-content">
        <Sidebar />
        <div className="ml-[24px] min-h-screen">
          <Header page={route} onQuickAction={navigate} onNavigate={navigate} />
          <main className="p-8">{content}</main>
        </div>
      </div>
      <ToastStack toasts={toasts} />
    </>
  );
}
