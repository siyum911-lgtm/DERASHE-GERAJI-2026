import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getDateLocale, setActiveLanguage, translate } from './i18n.js';
import {
  Activity, ArrowRight, ArrowUpRight, Battery, Bell, CarFront, Check, ChevronRight, Clock3,
  ClipboardList, CreditCard, Gauge, MapPin, Menu, Search, ShieldCheck, Star, Truck,
  UserRound, Wrench, X, Pencil, Trash2, Printer, AlertTriangle, Package, Cpu, Plus, FileText, CheckCircle2
} from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dg-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const money = (amount) => `${translate('ETB')} ${Number(amount || 0).toLocaleString(getDateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const explainError = (error) => error.response?.data?.error || 'Something went wrong. Please try again.';
const categoryIcons = [Wrench, Activity, Gauge, Activity, CarFront, Battery, Activity, Search, Activity, Activity, Activity, Activity, Activity, Wrench, Truck, Truck];
const paymentMethods = ['Cash', 'Telebirr', 'CBE Bank Transfer', 'Bank transfer', 'Other'];

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('dg-language');
    const initialLanguage = savedLanguage === 'am' ? 'am' : 'en';
    setActiveLanguage(initialLanguage);
    return initialLanguage;
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('dg-token');
    if (!token) { setAuthReady(true); return; }
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => localStorage.removeItem('dg-token')).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    setActiveLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  const changeLanguage = (nextLanguage) => {
    setActiveLanguage(nextLanguage);
    localStorage.setItem('dg-language', nextLanguage);
    setLanguage(nextLanguage);
  };

  const logout = () => { localStorage.removeItem('dg-token'); setUser(null); navigate('/'); };
  const login = (data) => { localStorage.setItem('dg-token', data.token); setUser(data.user); };

  if (!authReady) return (
    <div className="loading-screen">
      <div className="loading-screen__inner">
        <div className="loading-screen__logo"><Wrench size={28} color="white" /></div>
        <div className="loading-screen__text">DERASHE GERAJI</div>
        <div className="loading-screen__sub">{translate("Loading your garage management system…")}</div>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser: setUser, language, changeLanguage }}>
      <div className="shell">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetails />} />
          <Route path="/mechanics" element={<Mechanics />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/roadside" element={<Roadside />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <MobileNav />
      </div>
    </AuthContext.Provider>
  );
}

function Header() {
  const { user, logout, language, changeLanguage } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><Wrench size={20} /></span>
          <span>{translate("DERASHE")} {translate("GERAJI")}</span>
        </Link>
        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/services" onClick={() => setOpen(false)}>{translate("Car Services")}</NavLink>
          <NavLink to="/mechanics" onClick={() => setOpen(false)}>{translate("Mechanics")}</NavLink>
          <NavLink to="/roadside" onClick={() => setOpen(false)}>{translate("Roadside Help")}</NavLink>

          {user && (
            <>
              {user.role === 'customer' && <NavLink to="/vehicles" onClick={() => setOpen(false)}>{translate("My vehicles")}</NavLink>}
              <NavLink to="/bookings" onClick={() => setOpen(false)}>{translate("Bookings")}</NavLink>
              {['admin', 'provider', 'mechanic', 'cashier'].includes(user.role) && (
                <NavLink to="/inventory" onClick={() => setOpen(false)}>{translate("Inventory")}</NavLink>
              )}
              {['admin', 'provider', 'mechanic'].includes(user.role) && (
                <NavLink to="/equipment" onClick={() => setOpen(false)}>{translate("Equipment")}</NavLink>
              )}
              {['admin', 'provider', 'cashier', 'customer'].includes(user.role) && (
                <NavLink to="/invoices" onClick={() => setOpen(false)}>{translate("Invoices & Receipts")}</NavLink>
              )}
              <NavLink to="/dashboard" onClick={() => setOpen(false)}>{translate("Dashboard")}</NavLink>
              <div className="mobile-only-action" style={{flexDirection:'column',gap:8,paddingTop:10,borderTop:'1px solid #edf0f1'}}>
                <Link to="/notifications" className="btn btn-outline btn-small" onClick={() => setOpen(false)}>
                  <Bell size={16}/>{translate(" Notifications")}
                </Link>
                <button className="btn btn-outline btn-small" onClick={() => { setOpen(false); logout(); }}>
                  {translate("Sign out (")}{user.name}{translate(")")}
                </button>
              </div>
            </>
          )}

          {!user && (
            <div className="mobile-only-action" style={{flexDirection:'column',gap:8,paddingTop:10,borderTop:'1px solid #edf0f1'}}>
              <Link className="btn btn-outline btn-small" to="/login" onClick={() => setOpen(false)}>{translate("Log in")}</Link>
              <Link className="btn btn-small" to="/register" onClick={() => setOpen(false)}>{translate("Get started ")}<ArrowRight size={15} /></Link>
            </div>
          )}
        </nav>

        <div className="nav-actions">
          <button
            className="btn btn-outline btn-small language-switch"
            onClick={() => changeLanguage(language === 'en' ? 'am' : 'en')}
            aria-label={translate(language === 'en' ? 'Switch to Amharic' : 'Switch to English')}
            title={translate(language === 'en' ? 'Switch to Amharic' : 'Switch to English')}
          >
            {language === 'en' ? 'አማርኛ' : 'English'}
          </button>
          {user ? (
            <>
              <span className={`role-badge role-${user.role || 'customer'}`} title={`Role: ${user.role}`}>
                {translate(user.role)}
              </span>
              <Link to="/notifications" className="btn btn-outline btn-small" aria-label={translate("Notifications")}><Bell size={16} /></Link>
              <button className="btn btn-outline btn-small" onClick={logout}>{translate("Sign out")}</button>
            </>
          ) : (
            <>
              <Link className="btn btn-outline btn-small" to="/login">{translate("Log in")}</Link>
              <Link className="btn btn-small" to="/register">{translate("Get started ")}<ArrowRight size={15} /></Link>
            </>
          )}
        </div>
        <button className="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer no-print">
      <div className="container">
        <div className="footer-inner">
          <div>
            <Link to="/" className="brand">
              <span className="brand-mark"><Wrench size={20} /></span>
              {translate("DERASHE GERAJI")}
            </Link>
            <p>{translate("Connecting drivers with trusted mechanics. Book reliable automotive repair, maintenance, diagnostics, and roadside assistance.")}</p>
          </div>
          <div>
            <strong>{translate("Automotive help, made simple.")}</strong>
            <p>{translate("Built for drivers and service providers across Ethiopia.")}</p>
            <Link className="inline-link" to="/services">{translate("Browse car services ")}<ArrowRight size={14} /></Link>
          </div>
        </div>
        <div className="footer-bottom">
          {translate("© ")}{new Date().getFullYear()}{translate(" DERASHE GERAJI · Smart Car Repair and Maintenance Service Management System")}
        </div>
      </div>
    </footer>
  );
}

function MobileNav() {
  const { user } = useAuth();
  return (
    <nav className="mobile-bottom no-print">
      <NavLink to="/services"><Wrench size={17} />{translate("Services")}</NavLink>
      <NavLink to="/roadside"><Truck size={17} />{translate("Roadside")}</NavLink>
      <NavLink to={user ? '/bookings' : '/login'}><ClipboardList size={17} />{translate("Bookings")}</NavLink>
      {user && ['admin', 'provider', 'cashier'].includes(user.role) && (
        <NavLink to="/invoices"><FileText size={17} />{translate("Invoices")}</NavLink>
      )}
      <NavLink to={user ? '/dashboard' : '/login'}><UserRound size={17} />{translate("Account")}</NavLink>
    </nav>
  );
}

function Home() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data)).catch(() => setCategories([]));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-content">
          <div className="eyebrow"><ShieldCheck size={16} />{translate(" Verified automotive professionals")}</div>
          <h1>{translate("Find Trusted Car Repair Services Near You.")}</h1>
          <p>{translate("Connect with verified mechanics and automotive workshops for reliable repair, maintenance, diagnostics, and roadside assistance.")}</p>
          <div className="hero-actions">
            <Link className="btn" to="/services">{translate("Find a Car Service ")}<ArrowRight size={17} /></Link>
            <Link className="btn btn-outline" to="/roadside"><Truck size={17} />{translate(" Request Roadside Assistance")}</Link>
          </div>
          <p style={{fontSize:13,marginTop:22,marginBottom:0}}>
            {translate("Are you a mechanic or workshop? ")}
            <Link to="/register?role=provider" style={{color:'#68dfad',fontWeight:700}}>{translate("Become a Service Provider ")}<ArrowUpRight size={14} /></Link>
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{translate("Service directory")}</div>
              <h2>{translate("Automotive care, all in one place")}</h2>
              <p>{translate("Find experienced professionals for the service your vehicle needs.")}</p>
            </div>
            <Link className="btn btn-outline" to="/services">{translate("Explore services ")}<ArrowRight size={16} /></Link>
          </div>
          <div className="grid grid-4">
            {categories.slice(0,8).map((category, index) => {
              const Icon = categoryIcons[index % categoryIcons.length];
              return (
                <Link className="card service-card" key={category.id} to={`/services?category=${category.id}`} style={{textDecoration:'none'}}>
                  <div className="icon-box"><Icon size={21}/></div>
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <span className="inline-link">{translate("Explore ")}<ChevronRight size={14}/></span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section section-muted">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{translate("Your vehicle. Your choice.")}</div>
              <h2>{translate("Repair without the guesswork")}</h2>
              <p>{translate("Transparent provider profiles, estimated prices, and repair progress updates.")}</p>
            </div>
          </div>
          <div className="grid grid-3">
            {[
              ['Verified providers', 'Provider profiles are reviewed by administrators before services go live.', ShieldCheck],
              ['One place for every repair', 'Keep your vehicles, bookings, and repair history together.', CarFront],
              ['Help when you need it', 'Request roadside support and contact the provider directly.', Truck]
            ].map(([title, text, Icon]) => (
              <div className="card" key={title}>
                <div className="icon-box"><Icon size={22}/></div>
                <h3 style={{marginTop:17}}>{translate(title)}</h3>
                <p className="muted" style={{lineHeight:1.6,marginBottom:0}}>{translate(text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Page({ title, subtitle, action, children }) {
  return (
    <main className="page">
      <div className="container">
        <div className="page-top">
          <div>
            <h1 className="page-title">{translate(title)}</h1>
            {subtitle && <p className="page-subtitle">{translate(subtitle)}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </main>
  );
}

function LoadBlock() {
  return (
    <div className="loading">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 0.8s linear infinite',color:'var(--color-primary)'}}>
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      {translate('Loading…')}
    </div>
  );
}
function ErrorMessage({ message }) { return message ? <div role="alert" className="alert alert-error">{translate(message)}</div> : null; }
function Empty({ icon: Icon = ClipboardList, title = 'Nothing here yet', text = 'When there is activity, it will appear here.' }) {
  return <div className="card empty"><Icon size={28}/><h3>{translate(title)}</h3><p>{translate(text)}</p></div>;
}

function useLoad(url, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.get(url)
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(explainError(e)); });
    return () => { active = false; };
  // Include url in deps so re-fetches happen when url changes
  }, [url, ...deps]);
  return { data, error, setData };
}

// Page-level banner with module-specific color
function PageBanner({ module, title, subtitle, action }) {
  const colors = {
    vehicles:  { bg: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)', icon: '🚗' },
    bookings:  { bg: 'linear-gradient(135deg, #0f766e 0%, #0d5f58 100%)', icon: '📋' },
    inventory: { bg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', icon: '📦' },
    roadside:  { bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', icon: '🚛' },
    equipment: { bg: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', icon: '🔧' },
    billing:   { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', icon: '🧾' },
    reviews:   { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '⭐' },
    admin:     { bg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', icon: '🛡️' },
  };
  const { bg, icon } = colors[module] || { bg: 'linear-gradient(135deg, #0f766e 0%, #0d5f58 100%)', icon: '✦' };
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '20px 24px', marginBottom: 22, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, boxShadow: '0 4px 18px rgba(0,0,0,.15)' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', opacity: .75, marginBottom: 4 }}>{icon} {module}</div>
        <h1 style={{ margin: 0, fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 'clamp(18px,3vw,24px)', letterSpacing: '-.02em' }}>{translate(title)}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, opacity: .82 }}>{translate(subtitle)}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

function Services() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState({
    search: params.get('search') || '',
    location: '',
    category: params.get('category') || '',
    maxPrice: '',
    minRating: '',
    available: false
  });
  const [query, setQuery] = useState({});
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data)).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
    api.get(`/services?${qs}`).then(({ data }) => { if (active) { setItems(data); setError(''); } }).catch((e) => { if (active) { setError(explainError(e)); setItems([]); } });
    return () => { active = false; };
  }, [query]);

  const submit = (e) => {
    e.preventDefault();
    setQuery(filter);
    const next = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => { if (value && value !== false) next.set(key, String(value)); });
    setParams(next);
  };

  return (
    <Page title={translate("Car services")} subtitle="Search trusted automotive professionals and compare services, ratings, and estimates.">
      <form className="card filters" onSubmit={submit}>
        <div className="search-wide">
          <label className="field" style={{margin:0}}>
            <span className="sr-only">{translate("Search services")}</span>
            <div style={{position:'relative'}}>
              <Search size={17} style={{position:'absolute',left:12,top:13,color:'#82909b'}}/>
              <input className="input" style={{paddingLeft:38}} placeholder={translate("Search a service or provider")} value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})}/>
            </div>
          </label>
        </div>
        <select className="select" aria-label={translate("Service category")} value={filter.category} onChange={e => setFilter({...filter, category: e.target.value})}>
          <option value="">{translate("All categories")}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" aria-label={translate("Location")} placeholder={translate("Location (e.g. Addis Ababa)")} value={filter.location} onChange={e => setFilter({...filter, location: e.target.value})}/>
        <button className="btn"><Search size={16}/>{translate("Search")}</button>
        <input className="input" aria-label={translate("Maximum price")} type="number" min="0" placeholder={translate("Max price (ETB)")} value={filter.maxPrice} onChange={e => setFilter({...filter, maxPrice: e.target.value})}/>
        <select className="select" aria-label={translate("Minimum rating")} value={filter.minRating} onChange={e => setFilter({...filter, minRating: e.target.value})}>
          <option value="">{translate("Any rating")}</option>
          <option value="4">{translate("4+ stars")}</option>
          <option value="3">{translate("3+ stars")}</option>
        </select>
      </form>
      <ErrorMessage message={error}/>
      {items === null ? <LoadBlock/> : items.length === 0 ? (
        <Empty icon={Search} title={translate("No matching services")} text="Try a different category or location, or check back as more providers join."/>
      ) : (
        <div className="grid grid-3">{items.map(item => <ServiceCard key={item.id} service={item}/>)}</div>
      )}
    </Page>
  );
}

function ServiceCard({ service }) {
  return (
    <article className="card service-card">
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
        <div className="icon-box"><Wrench size={20}/></div>
        <span className="rating"><Star size={14} fill="currentColor"/>{Number(service.rating || 0).toFixed(1)}</span>
      </div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="muted" style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}><MapPin size={14}/>{service.location}</div>
      <div className="service-footer">
        <div>
          <span className="price">{money(service.price)}</span>
          <div className="muted" style={{fontSize:11}}>{translate("est. ")}{service.estimated_minutes}{translate(" min")}</div>
        </div>
        <Link className="btn btn-small" to={`/services/${service.id}`}>{translate("View service ")}<ArrowRight size={14}/></Link>
      </div>
    </article>
  );
}

function ServiceDetails() {
  const { id } = useParams();
  const { data: service, error } = useLoad(`/services/${id}`, [id]);

  if (service === null) return <Page title={translate("Service details")}><LoadBlock/></Page>;
  if (error) return <Page title={translate("Service details")}><ErrorMessage message={error}/></Page>;
  if (!service) return (
    <Page title={translate("Service unavailable")}>
      <Empty title={translate("We couldn't find this service")} text="The service may no longer be listed."/>
      <Link className="btn" to="/services">{translate("Browse services")}</Link>
    </Page>
  );

  return (
    <Page title={service.name} subtitle={service.category}>
      <div className="detail-layout">
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span className="badge badge-green"><ShieldCheck size={13}/>{translate(" Verified provider")}</span>
            <span className="rating"><Star size={15} fill="currentColor"/>{Number(service.rating || 0).toFixed(1)}{translate(" (")}{service.review_count}{translate(" reviews)")}</span>
          </div>
          <h2 style={{color:'#102a43',marginTop:20}}>{service.business_name}</h2>
          <p className="muted">{service.description}</p>
          <div className="pill-row">
            <span className="pill"><MapPin size={14}/> {service.location}</span>
            <span className="pill">{service.experience_years}{translate(" years experience")}</span>
            <span className="pill">{service.provider_type}</span>
          </div>
          <div style={{marginTop:24,borderTop:'1px solid #edf0f1',paddingTop:18}}>
            <h3>{translate("About this provider")}</h3>
            <p className="muted">{translate("Automotive specialist offering ")}{service.category.toLowerCase()}{translate(" services in ")}{service.location}{translate(".")}</p>
            <a className="btn btn-outline" href={`tel:${service.phone}`}><Activity size={16}/>{translate(" Call provider")}</a>
          </div>
        </div>
        <BookingForm service={service}/>
      </div>
    </Page>
  );
}

function BookingForm({ service }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicleId: '', problemDescription: '', scheduledAt: '', callbackRequested: false, paymentPreference: 'Cash' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role === 'customer') {
      api.get('/vehicles').then(({ data }) => setVehicles(data)).catch(e => setError(explainError(e)));
    }
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/bookings', { ...form, vehicleId: Number(form.vehicleId), serviceId: service.id, scheduledAt: new Date(form.scheduledAt).toISOString() });
      navigate('/bookings', { state: { success: 'Your repair request was sent to the provider.' } });
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>{translate("Request this service")}</h3>
      <p className="muted">{translate("Estimated price ")}<strong className="price">{money(service.price)}</strong></p>
      {!user ? (
        <>
          <p className="muted">{translate("Log in or create an account to book an appointment.")}</p>
          <Link className="btn" to="/login">{translate("Log in to book")}</Link>
        </>
      ) : user.role !== 'customer' ? (
        <div className="alert alert-error">{translate("Only customer accounts can place repair bookings.")}</div>
      ) : vehicles.length === 0 ? (
        <>
          <p className="muted">{translate("Add your vehicle before making a booking.")}</p>
          <Link className="btn" to="/vehicles">{translate("Add a vehicle ")}<ArrowRight size={15}/></Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>{translate("Vehicle")}</label>
            <select className="select" required value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})}>
              <option value="">{translate("Choose your vehicle")}</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}{translate(" · ")}{v.plate_number}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{translate("Describe the problem")}</label>
            <textarea className="textarea" required minLength="5" placeholder={translate("What is happening with your vehicle?")} value={form.problemDescription} onChange={e => setForm({...form, problemDescription: e.target.value})}/>
          </div>
          <div className="field">
            <label>{translate("Preferred appointment")}</label>
            <input className="input" required type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})}/>
          </div>
          <fieldset className="field payment-method-field">
            <legend>{translate("Preferred payment method")}</legend>
            <p className="muted payment-help">{translate("This saves your preference only. Confirm offline payment with provider.")}</p>
            <div className="payment-method-options">
              {paymentMethods.map(method => (
                <label key={method} className={`payment-method-option ${form.paymentPreference === method ? 'selected' : ''}`}>
                  <input type="radio" name={`booking-payment-${service.id}`} value={method} checked={form.paymentPreference === method} onChange={e => setForm({...form, paymentPreference: e.target.value})}/>
                  <span>{translate(method)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label style={{display:'flex',gap:8,alignItems:'center',fontSize:13,marginBottom:14}}>
            <input type="checkbox" checked={form.callbackRequested} onChange={e => setForm({...form, callbackRequested: e.target.checked})}/>
            {translate(" Request a mechanic callback")}
          </label>
          <ErrorMessage message={error}/>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Submit booking request'} <ArrowRight size={15}/></button>
        </form>
      )}
    </div>
  );
}

function Mechanics() {
  const [location, setLocation] = useState('');
  const [query, setQuery] = useState('');
  const { data: providers, error } = useLoad(`/providers${query ? `?location=${encodeURIComponent(query)}` : ''}`, [query]);

  return (
    <Page title={translate("Mechanics & workshops")} subtitle="Get to know verified automotive professionals before you book.">
      <form className="card filters" style={{gridTemplateColumns:'1fr auto'}} onSubmit={e => { e.preventDefault(); setQuery(location); }}>
        <input className="input" placeholder={translate("Filter by location")} value={location} onChange={e => setLocation(e.target.value)}/>
        <button className="btn"><Search size={16}/>{translate("Find providers")}</button>
      </form>
      <ErrorMessage message={error}/>
      {providers === null ? <LoadBlock/> : providers.length === 0 ? (
        <Empty icon={UserRound} title={translate("No verified providers found")} text="Try another location or check back soon."/>
      ) : (
        <div className="grid grid-3">
          {providers.map(p => (
            <article className="card" key={p.id}>
              <div className="provider-card">
                <div className="provider-avatar"><Wrench size={22}/></div>
                <div>
                  <h3 style={{marginBottom:5}}>{p.business_name}</h3>
                  <span className="badge badge-green"><ShieldCheck size={12}/>{translate(" Verified ")}{p.provider_type}</span>
                </div>
              </div>
              <p className="muted" style={{marginTop:17}}>{p.bio || 'Automotive repair and maintenance professional.'}</p>
              <div className="provider-meta">
                <span><MapPin size={14}/>{p.location}</span>
                <span><Star size={14} color="#dc9f20"/>{Number(p.rating).toFixed(1)}{translate(" (")}{p.review_count}{translate(")")}</span>
                <span>{p.experience_years}{translate(" years")}</span>
              </div>
              <a className="btn btn-outline" style={{marginTop:17}} href={`tel:${p.phone}`}><Activity size={15}/>{translate(" Call ")}{p.phone}</a>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

// ==========================================
// VEHICLES & VEHICLE SERVICE HISTORY
// ==========================================

function Vehicles() {
  const { user } = useAuth();
  if (!user) return <Page title={translate("Sign in required")}><SignInPrompt/></Page>;
  return <VehiclesContent/>;
}

function VehiclesContent() {
  const { data: vehicles, error, setData } = useLoad('/vehicles', []);
  const [form, setForm] = useState({ make: '', model: '', year: new Date().getFullYear(), plateNumber: '', vin: '', mileage: 0, fuelType: 'Petrol', imageUrl: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post('/vehicles', form);
      setData([data, ...(vehicles || [])]);
      setForm({ make: '', model: '', year: new Date().getFullYear(), plateNumber: '', vin: '', mileage: 0, fuelType: 'Petrol', imageUrl: '' });
      setMessage('Vehicle added successfully.');
    } catch (e) {
      setMessage(explainError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this vehicle from your garage?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      setData(vehicles.filter(v => v.id !== id));
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  return (
    <Page title={translate("My vehicles")} subtitle="Keep your vehicle details ready for bookings, roadside assistance, and service histories." action={<Link className="btn btn-outline" to="/services">{translate("Find a service ")}<ArrowRight size={15}/></Link>}>
      <PageBanner module="vehicles" title="My Vehicles" subtitle="Manage your car fleet, plate numbers, service history, and fuel type." action={<Link className="btn" style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.3)'}} to="/services">{translate("Find a service ")}<ArrowRight size={15}/></Link>}/>
      <div className="grid grid-3">
        <form className="card" onSubmit={submit}>
          <h3>{translate("Add a vehicle")}</h3>
          <div className="field"><label>{translate("Make")}</label><input className="input" required placeholder="e.g. Toyota" value={form.make} onChange={e => setForm({...form, make: e.target.value})}/></div>
          <div className="field"><label>{translate("Model")}</label><input className="input" required placeholder="e.g. Hilux / Corolla" value={form.model} onChange={e => setForm({...form, model: e.target.value})}/></div>
          <div className="form-grid">
            <div className="field"><label>{translate("Year")}</label><input className="input" type="number" min="1950" max="2100" required value={form.year} onChange={e => setForm({...form, year: e.target.value})}/></div>
            <div className="field"><label>{translate("Plate number")}</label><input className="input" required placeholder="e.g. 3-B12345 AA" value={form.plateNumber} onChange={e => setForm({...form, plateNumber: e.target.value})}/></div>
          </div>
          <div className="field"><label>{translate("VIN / chassis number (optional)")}</label><input className="input" value={form.vin} onChange={e => setForm({...form, vin: e.target.value})}/></div>
          <div className="form-grid">
            <div className="field"><label>{translate("Mileage (km)")}</label><input className="input" type="number" min="0" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})}/></div>
            <div className="field">
              <label>{translate("Fuel type")}</label>
              <select className="select" value={form.fuelType} onChange={e => setForm({...form, fuelType: e.target.value})}>
                {['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Other'].map(x => <option key={x}>{translate(x)}</option>)}
              </select>
            </div>
          </div>
          <ErrorMessage message={message}/>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add vehicle'}</button>
        </form>

        <div className="grid" style={{gridColumn:'span 2',alignContent:'start'}}>
          {error && <ErrorMessage message={error}/>}
          {vehicles === null ? <LoadBlock/> : vehicles.length === 0 ? (
            <Empty icon={CarFront} title={translate("Your garage is empty")} text="Add a vehicle to start booking a repair or tracking service history."/>
          ) : (
            vehicles.map(v => (
              <article className="card card-vehicle" key={v.id} style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{display:'flex',gap:13,alignItems:'center'}}>
                  <div className="icon-box"><CarFront/></div>
                  <div>
                    <h3 style={{marginBottom:5}}>{v.year} {v.make} {v.model}</h3>
                    <span className="muted" style={{fontSize:13}}>
                      <strong style={{color:'#102a43'}}>{v.plate_number}</strong> · {Number(v.mileage).toLocaleString(getDateLocale())} km · {v.fuel_type}
                    </span>
                    {v.vin && <div className="muted" style={{fontSize:11}}>VIN: {v.vin}</div>}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn btn-outline btn-small" onClick={() => setSelectedVehicleForHistory(v.id)}>
                    <ClipboardList size={14}/> {translate("Service History")}
                  </button>
                  <button className="btn btn-danger btn-small" onClick={() => remove(v.id)}>{translate("Remove")}</button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {selectedVehicleForHistory && (
        <VehicleHistoryModal vehicleId={selectedVehicleForHistory} close={() => setSelectedVehicleForHistory(null)}/>
      )}
    </Page>
  );
}

function VehicleHistoryModal({ vehicleId, close }) {
  const { data, error } = useLoad(`/vehicles/${vehicleId}/history`, [vehicleId]);

  return (
    <Modal title="Vehicle Service History" close={close}>
      {error && <ErrorMessage message={error}/>}
      {data === null ? <LoadBlock/> : (
        <div>
          <div style={{background:'#f5f7f8',padding:'12px 16px',borderRadius:8,marginBottom:18}}>
            <h4 style={{margin:0,color:'#102a43'}}>{data.vehicle.year} {data.vehicle.make} {data.vehicle.model}</h4>
            <div className="muted" style={{fontSize:13}}>
              Plate: <strong>{data.vehicle.plate_number}</strong> | Owner: {data.vehicle.owner_name} ({data.vehicle.owner_phone})
            </div>
          </div>

          <h3>Past Repairs & Maintenance ({data.history.length})</h3>
          {data.history.length === 0 ? (
            <p className="muted">No past repair records found for this vehicle.</p>
          ) : (
            <div className="grid" style={{gap:12}}>
              {data.history.map(item => (
                <div key={item.booking_id} style={{border:'1px solid #e2e8eb',borderRadius:8,padding:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <strong>{item.service_name} ({item.service_category})</strong>
                      <div className="muted" style={{fontSize:12}}>Garage: {item.garage_name} · {new Date(item.scheduled_at).toLocaleDateString(getDateLocale())}</div>
                      {item.mechanic_name && <div style={{fontSize:12,color:'#13835f'}}>Mechanic: <strong>{item.mechanic_name}</strong></div>}
                    </div>
                    <Status status={item.booking_status}/>
                  </div>
                  {item.diagnosis && (
                    <div style={{marginTop:10,fontSize:13}}>
                      <div><strong>Diagnosis:</strong> {item.diagnosis}</div>
                      <div><strong>Work Done:</strong> {item.work_performed}</div>
                      {item.invoice_total != null && (
                        <div style={{marginTop:6}}><strong>Total Paid/Billed:</strong> {money(item.invoice_total)}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const statusClass = (status) => {
  if (['Completed', 'Paid', 'Recorded', 'Operational'].includes(status)) return 'badge-green';
  if (['In Progress', 'Scheduled', 'Calibrated'].includes(status)) return 'badge-blue';
  if (['Pending', 'Awaiting Admin Approval', 'Pending_Verification'].includes(status)) return 'badge-yellow';
  if (['Approved for Payment'].includes(status)) return 'badge-purple';
  if (['Rejected', 'Cancelled', 'Maintenance Required', 'Under Repair'].includes(status)) return 'badge-red';
  return 'badge-blue';
};

const roleBadgeClass = (role) => `role-badge role-${role || 'customer'}`;

function Status({ status }) { return <span className={`badge ${statusClass(status)}`}>{translate(status)}</span>; }

// ==========================================
// BOOKINGS & REPAIRS TRACKING
// ==========================================

function Bookings() {
  const { user } = useAuth();
  const { data: bookings, error, setData } = useLoad('/bookings', [user?.id]);
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get('/bookings');
      setData(data);
      setMessage('Service requests refreshed.');
    } catch (e) {
      setMessage(explainError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const change = async (id, status) => {
    try {
      const { data } = await api.patch(`/bookings/${id}/status`, { status });
      setData(current => current?.map(b => String(b.id) === String(id) ? { ...b, ...data } : b));
      setMessage(`Booking #${id} updated to ${status}.`);
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  const review = async (id, action) => {
    try {
      const { data } = await api.patch(`/bookings/${id}/admin-review`, { action });
      setData(current => current?.map(b => String(b.id) === String(id) ? { ...b, ...data } : b));
      setMessage(action === 'approve-report' ? `Booking #${id} approved for customer payment.` : `Booking #${id} finalized.`);
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  const reportSaved = (report) => {
    setData(current => current?.map(b => String(b.id) === String(report.booking_id) ? {
      ...b,
      repair_diagnosis: report.diagnosis,
      repair_work_performed: report.work_performed,
      repair_parts_used: report.parts_used,
      repair_labor_cost: report.labor_cost,
      repair_parts_cost: report.parts_cost,
      reported_amount: Number(report.labor_cost || 0) + Number(report.parts_cost || 0),
      repair_completed_at: report.completed_at,
      status: report.booking_status,
      invoice_number: report.invoice_number,
      invoice_total: report.total_amount
    } : b));
  };

  const mechanicAssigned = (bookingId, mechanicName, mechanicId) => {
    setData(current => current?.map(b => String(b.id) === String(bookingId) ? { ...b, mechanic_id: mechanicId, mechanic_name: mechanicName } : b));
  };

  if (!user) return <Page title={translate("My bookings")}><SignInPrompt/></Page>;

  return (
    <Page
      title={user.role === 'customer' ? 'My bookings' : user.role === 'admin' ? 'All service requests' : user.role === 'mechanic' ? 'My Assigned Repairs' : 'Booking requests'}
      subtitle="Follow vehicle repairs in real-time from booking to payment and completion."
      action={
        user.role === 'customer'
          ? <Link className="btn" to="/services">{translate("Find a service")}</Link>
          : <button className="btn btn-outline" onClick={refresh} disabled={refreshing}>{translate(refreshing ? "Refreshing…" : "Refresh requests")}</button>
      }
    >
      <PageBanner
        module="bookings"
        title={user.role === 'customer' ? 'My Bookings' : user.role === 'admin' ? 'All Service Requests' : user.role === 'mechanic' ? 'My Assigned Repairs' : 'Booking Requests'}
        subtitle="Track repair status, mechanic assignments, and service progress in real-time."
        action={user.role === 'customer'
          ? <Link className="btn" style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.3)'}} to="/services">{translate("Book a service")}</Link>
          : <button className="btn" style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.3)'}} onClick={refresh} disabled={refreshing}>{translate(refreshing ? "Refreshing…" : "↻ Refresh")}</button>}
      />
      {message && <div className="alert alert-success">{message}</div>}
      <ErrorMessage message={error}/>
      {bookings === null ? <LoadBlock/> : bookings.length === 0 ? (
        <Empty title={translate("No bookings yet")} text={user.role === 'customer' ? 'Your repair requests will appear here.' : 'New customer requests will appear here.'}/>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{translate("Booking")}</th>
                <th>{translate("Vehicle / Service")}</th>
                {['admin', 'provider', 'cashier'].includes(user.role) && <th>{translate("Customer")}</th>}
                {user.role === 'customer' && <th>{translate("Provider")}</th>}
                <th>{translate("Assigned Mechanic")}</th>
                <th>{translate("Appointment")}</th>
                <th>{translate("Status")}</th>
                <th>{translate("Payment")}</th>
                <th>{translate("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td>
                    <strong>#{b.id}</strong>
                    <div className="muted">{money(b.estimate)}</div>
                  </td>
                  <td>
                    <strong>{b.year} {b.make} {b.model}</strong> ({b.plate_number})
                    <div className="muted">{b.service_name}</div>
                    <div className="muted" style={{whiteSpace:'normal',maxWidth:240}}>{b.problem_description}</div>
                  </td>
                  {['admin', 'provider', 'cashier'].includes(user.role) && (
                    <td>
                      {b.customer_name}
                      <div><a className="inline-link" href={`tel:${b.customer_phone}`}>{b.customer_phone}</a></div>
                    </td>
                  )}
                  {user.role === 'customer' && (
                    <td>
                      {b.business_name}
                      <div><a className="inline-link" href={`tel:${b.provider_phone}`}>{b.provider_phone}</a></div>
                    </td>
                  )}
                  <td>
                    {b.mechanic_name ? (
                      <span className="badge badge-green"><Wrench size={12}/> {b.mechanic_name}</span>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                  </td>
                  <td>{new Date(b.scheduled_at).toLocaleString(getDateLocale())}</td>
                  <td><Status status={b.status}/></td>
                  <td>
                    {b.invoice_total != null ? (
                      <>
                        <strong>{money(b.invoice_total)}</strong>
                        <div className="muted">{b.invoice_payment_status || 'Unpaid'}</div>
                      </>
                    ) : (
                      <span className="muted">{b.payment_preference || 'Cash'}</span>
                    )}
                  </td>
                  <td>
                    <BookingActions
                      booking={b}
                      role={user.role}
                      change={change}
                      review={review}
                      reportSaved={reportSaved}
                      mechanicAssigned={mechanicAssigned}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function BookingActions({ booking, role, change, review, reportSaved, mechanicAssigned }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const canAssign = ['provider', 'admin'].includes(role);
  const canStartRepair = (['provider', 'mechanic', 'admin'].includes(role) && ['Accepted', 'Scheduled'].includes(booking.status));
  const canSubmitReport = (['provider', 'mechanic', 'admin'].includes(role) && booking.status === 'In Progress');

  return (
    <div className="row-actions">
      {canAssign && (
        <button className="btn btn-small btn-outline" onClick={() => setAssignOpen(true)}>
          <Wrench size={13}/> {booking.mechanic_id ? translate("Reassign") : translate("Assign Mechanic")}
        </button>
      )}

      {role === 'provider' && booking.status === 'Pending' && (
        <>
          <button className="btn btn-small" onClick={() => change(booking.id, 'Accepted')}>{translate("Accept")}</button>
          <button className="btn btn-small btn-danger" onClick={() => change(booking.id, 'Rejected')}>{translate("Reject")}</button>
        </>
      )}

      {canStartRepair && (
        <button className="btn btn-small" onClick={() => change(booking.id, 'In Progress')}>{translate("Start Repair")}</button>
      )}

      {canSubmitReport && (
        <button className="btn btn-small btn-outline" onClick={() => setRepairOpen(true)}>{translate("Submit service report")}</button>
      )}

      {booking.repair_diagnosis && (
        <button className="btn btn-small btn-outline" onClick={() => setReportOpen(true)}>{translate("View Report")}</button>
      )}

      {booking.invoice_number && (
        <button className="btn btn-small btn-outline" onClick={() => setInvoiceOpen(true)}>
          <FileText size={13}/> {translate("Invoice / Receipt")}
        </button>
      )}

      {role === 'admin' && booking.status === 'Awaiting Admin Approval' && (
        <button className="btn btn-small" onClick={() => review(booking.id, 'approve-report')}>{translate("Approve report")}</button>
      )}

      {['cashier', 'provider', 'admin'].includes(role) && booking.status === 'Approved for Payment' && (
        <button className="btn btn-small" onClick={() => setPayOpen(true)}>{translate("Record Payment")}</button>
      )}

      {role === 'customer' && booking.status === 'Approved for Payment' && !booking.payment_status && (
        <button className="btn btn-small" onClick={() => setPayOpen(true)}>{translate("Choose payment method")}</button>
      )}

      {role === 'customer' && booking.status === 'Completed' && !booking.reviewed && (
        <button className="btn btn-small btn-outline" onClick={() => setReviewOpen(true)}>{translate("Review")}</button>
      )}

      {assignOpen && (
        <AssignMechanicModal booking={booking} close={() => setAssignOpen(false)} onAssigned={mechanicAssigned}/>
      )}
      {repairOpen && (
        <RepairModal booking={booking} close={() => setRepairOpen(false)} onSaved={reportSaved}/>
      )}
      {reportOpen && (
        <RepairReportModal booking={booking} close={() => setReportOpen(false)}/>
      )}
      {invoiceOpen && (
        <InvoiceReceiptModal bookingId={booking.id} close={() => setInvoiceOpen(false)}/>
      )}
      {payOpen && ['cashier', 'provider', 'admin'].includes(role) && (
        <RecordPaymentModal booking={booking} close={() => setPayOpen(false)} onSaved={() => window.location.reload()}/>
      )}
      {payOpen && role === 'customer' && (
        <CustomerPaymentModal booking={booking} close={() => setPayOpen(false)} onSaved={() => window.location.reload()}/>
      )}
      {reviewOpen && (
        <ReviewModal booking={booking} close={() => setReviewOpen(false)}/>
      )}
    </div>
  );
}

function AssignMechanicModal({ booking, close, onAssigned }) {
  const { data: mechanics, error } = useLoad('/mechanics', []);
  const [selectedMechanicId, setSelectedMechanicId] = useState(booking.mechanic_id || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const { data } = await api.patch(`/bookings/${booking.id}/assign-mechanic`, {
        mechanicId: selectedMechanicId ? Number(selectedMechanicId) : null
      });
      const mechObj = mechanics?.find(m => String(m.id) === String(selectedMechanicId));
      onAssigned(booking.id, mechObj ? mechObj.name : null, selectedMechanicId ? Number(selectedMechanicId) : null);
      close();
    } catch (err) {
      setMsg(explainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Assign Mechanic · Booking #${booking.id}`} close={close}>
      <form onSubmit={submit}>
        <p className="muted">Vehicle: <strong>{booking.make} {booking.model} ({booking.plate_number})</strong></p>
        {error && <ErrorMessage message={error}/>}
        <div className="field">
          <label>{translate("Select Mechanic")}</label>
          <select className="select" value={selectedMechanicId} onChange={e => setSelectedMechanicId(e.target.value)}>
            <option value="">-- {translate("Select Mechanic")} --</option>
            {mechanics?.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
            ))}
          </select>
        </div>
        <ErrorMessage message={msg}/>
        <div className="row-actions" style={{marginTop:18}}>
          <button className="btn" disabled={busy}>{busy ? 'Assigning…' : 'Save Assignment'}</button>
          <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function RepairModal({ booking, close, onSaved }) {
  const { data: inventory } = useLoad('/inventory', []);
  const [form, setForm] = useState({ diagnosis: '', workPerformed: '', laborCost: 0, partsCost: 0 });
  const [selectedParts, setSelectedParts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addPartFromInventory = (partId) => {
    if (!partId) return;
    const part = inventory?.find(p => String(p.id) === String(partId));
    if (!part) return;
    const existing = selectedParts.find(p => p.partId === part.id);
    if (existing) {
      setSelectedParts(selectedParts.map(p => p.partId === part.id ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setSelectedParts([...selectedParts, { partId: part.id, name: part.name, quantity: 1, unitPrice: Number(part.unit_price) }]);
    }
  };

  const removePart = (index) => {
    setSelectedParts(selectedParts.filter((_, i) => i !== index));
  };

  const partsTotal = selectedParts.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalCost = Number(form.laborCost || 0) + partsTotal;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        partsCost: partsTotal,
        partsUsed: selectedParts
      };
      const { data } = await api.put(`/bookings/${booking.id}/repair`, payload);
      onSaved(data);
      close();
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Submit Service Report · #${booking.id}`} close={close}>
      <form onSubmit={submit}>
        <div className="field">
          <label>{translate("Diagnosis")}</label>
          <textarea className="textarea" required minLength="2" placeholder="e.g. Worn front brake pads, contaminated brake fluid" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})}/>
        </div>
        <div className="field">
          <label>{translate("Work performed")}</label>
          <textarea className="textarea" required minLength="2" placeholder="e.g. Replaced front brake pads, bled brake system, road tested" value={form.workPerformed} onChange={e => setForm({...form, workPerformed: e.target.value})}/>
        </div>

        <div className="field">
          <label>{translate("Spare Parts from Inventory")}</label>
          <select className="select" onChange={e => { addPartFromInventory(e.target.value); e.target.value = ''; }}>
            <option value="">+ Add part from catalog</option>
            {inventory?.map(p => (
              <option key={p.id} value={p.id} disabled={p.quantity_in_stock <= 0}>
                {p.name} ({p.part_number}) - {money(p.unit_price)} [{p.quantity_in_stock} in stock]
              </option>
            ))}
          </select>
        </div>

        {selectedParts.length > 0 && (
          <div style={{background:'#f9fafb',padding:12,borderRadius:8,marginBottom:14}}>
            <strong>Selected Spare Parts:</strong>
            {selectedParts.map((item, idx) => (
              <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,fontSize:13}}>
                <span>{item.name} (x{item.quantity}) - {money(item.quantity * item.unitPrice)}</span>
                <button type="button" className="btn btn-danger btn-small" onClick={() => removePart(idx)}><Trash2 size={12}/></button>
              </div>
            ))}
            <div style={{marginTop:8,textAlign:'right',fontWeight:700}}>Parts Total: {money(partsTotal)}</div>
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label>{translate("Labor cost (ETB)")}</label>
            <input className="input" type="number" min="0" step="0.01" value={form.laborCost} onChange={e => setForm({...form, laborCost: e.target.value})}/>
          </div>
          <div className="field">
            <label>Calculated Subtotal</label>
            <input className="input" readOnly value={money(totalCost)}/>
          </div>
        </div>

        <p className="muted" style={{fontSize:12}}>* Ethiopian 15% VAT will be automatically calculated on the invoice.</p>
        <ErrorMessage message={error}/>
        <button className="btn" disabled={busy}>{busy ? translate("Submitting…") : translate("Submit service report")}</button>
      </form>
    </Modal>
  );
}

function RepairReportModal({ booking, close }) {
  const parts = typeof booking.repair_parts_used === 'string'
    ? booking.repair_parts_used
    : JSON.stringify(booking.repair_parts_used || []);

  return (
    <Modal title={`Service report · #${booking.id}`} close={close}>
      <p><strong>{translate("Diagnosis")}</strong><br/>{booking.repair_diagnosis}</p>
      <p><strong>{translate("Work performed")}</strong><br/>{booking.repair_work_performed}</p>
      {parts && parts !== '[]' && <p><strong>{translate("Parts used")}</strong><br/>{parts}</p>}
      <div className="form-grid">
        <p><strong>{translate("Labor cost (ETB)")}</strong><br/>{money(booking.repair_labor_cost)}</p>
        <p><strong>{translate("Parts cost (ETB)")}</strong><br/>{money(booking.repair_parts_cost)}</p>
      </div>
      <p><strong>{translate("Total service cost")}</strong><br/>{money(booking.reported_amount ?? Number(booking.repair_labor_cost || 0) + Number(booking.repair_parts_cost || 0))}</p>
      {booking.repair_completed_at && <p className="muted">{translate("Report submitted")}: {new Date(booking.repair_completed_at).toLocaleString(getDateLocale())}</p>}
    </Modal>
  );
}

// ==========================================
// INVOICES, OFFICIAL RECEIPTS & PRINTING
// ==========================================

function InvoicesPage() {
  const { user } = useAuth();
  const { data: invoices, error } = useLoad('/invoices', [user?.id]);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  if (!user) return <Page title={translate("Invoices & Receipts")}><SignInPrompt/></Page>;

  return (
    <Page title={translate("Invoices & Receipts")} subtitle="Official tax invoices, receipts, and payment documentation for Ethiopian garages.">
      <PageBanner module="billing" title="Invoices & Receipts" subtitle="Official Ethiopian VAT invoices, receipts, and complete payment audit trail."/>

      <ErrorMessage message={error}/>
      {invoices === null ? <LoadBlock/> : invoices.length === 0 ? (
        <Empty icon={FileText} title="No invoices yet" text="Invoices are created automatically when service reports are completed."/>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{translate("Invoice #")}</th>
                <th>{translate("Booking")}</th>
                <th>{translate("Customer")}</th>
                <th>{translate("Vehicle")}</th>
                <th>{translate("Subtotal")}</th>
                <th>{translate("VAT (15%)")}</th>
                <th>{translate("Total Amount")}</th>
                <th>{translate("Payment Status")}</th>
                <th>{translate("Receipt #")}</th>
                <th>{translate("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td>#{inv.booking_id}</td>
                  <td>{inv.customer_name}</td>
                  <td>{inv.year} {inv.make} {inv.model} ({inv.plate_number})</td>
                  <td>{money(inv.subtotal)}</td>
                  <td>{money(inv.tax_amount)}</td>
                  <td><strong style={{color:'#102a43'}}>{money(inv.total_amount)}</strong></td>
                  <td>
                    <span className={`badge ${inv.payment_status === 'Paid' ? 'badge-green' : 'badge-yellow'}`}>
                      {inv.payment_status}
                    </span>
                  </td>
                  <td>{inv.receipt_number || '—'}</td>
                  <td>
                    <button className="btn btn-outline btn-small" onClick={() => setSelectedBookingId(inv.booking_id)}>
                      <Printer size={13}/> {translate("Print / View")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedBookingId && (
        <InvoiceReceiptModal bookingId={selectedBookingId} close={() => setSelectedBookingId(null)}/>
      )}
    </Page>
  );
}

function InvoiceReceiptModal({ bookingId, close }) {
  const { data, error } = useLoad(`/invoices/${bookingId}`, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal title={`Invoice & Official Receipt · Booking #${bookingId}`} close={close}>
      {error && <ErrorMessage message={error}/>}
      {data === null ? <LoadBlock/> : (
        <div>
          <div className="invoice-container">
            <div className="invoice-header">
              <div>
                <div className="invoice-title">DERASHE GERAJI</div>
                <div style={{color:'#526676',fontSize:13}}>Automotive Repair & Garage Management</div>
                <div style={{color:'#526676',fontSize:12}}>Addis Ababa, Ethiopia · info@derashe-geraji.et</div>
              </div>
              <div className="invoice-meta">
                <div><strong>INVOICE:</strong> {data.invoice.invoice_number}</div>
                {data.invoice.receipt_number && <div><strong>RECEIPT:</strong> {data.invoice.receipt_number}</div>}
                <div><strong>Date:</strong> {new Date(data.invoice.created_at).toLocaleDateString(getDateLocale())}</div>
                <div style={{marginTop:4}}>
                  <span className={`badge ${data.invoice.payment_status === 'Paid' ? 'badge-green' : 'badge-yellow'}`}>
                    {data.invoice.payment_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="invoice-parties">
              <div>
                <strong style={{color:'#102a43'}}>SERVICE PROVIDER / GARAGE:</strong>
                <div>{data.invoice.business_name}</div>
                <div className="muted">{data.invoice.provider_location}</div>
                <div className="muted">Tel: {data.invoice.provider_phone}</div>
              </div>
              <div>
                <strong style={{color:'#102a43'}}>BILL TO (CUSTOMER):</strong>
                <div>{data.invoice.customer_name}</div>
                <div className="muted">Tel: {data.invoice.customer_phone}</div>
                <div className="muted">Vehicle: {data.invoice.year} {data.invoice.make} {data.invoice.model}</div>
                <div className="muted">Plate: <strong>{data.invoice.plate_number}</strong></div>
              </div>
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Labor: {data.invoice.work_performed || 'Automotive Service & Repair'}</td>
                  <td>1</td>
                  <td>{money(data.invoice.labor_cost)}</td>
                  <td>{money(data.invoice.labor_cost)}</td>
                </tr>
                {data.parts?.map((part, idx) => (
                  <tr key={idx}>
                    <td>Spare Part: {part.part_name} ({part.part_number})</td>
                    <td>{part.quantity}</td>
                    <td>{money(part.unit_price)}</td>
                    <td>{money(part.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-totals">
              <div className="invoice-totals-row">
                <span>Subtotal:</span>
                <span>{money(data.invoice.subtotal)}</span>
              </div>
              <div className="invoice-totals-row">
                <span>Ethiopian VAT (15%):</span>
                <span>{money(data.invoice.tax_amount)}</span>
              </div>
              <div className="invoice-totals-row invoice-total-highlight">
                <span>TOTAL AMOUNT:</span>
                <span>{money(data.invoice.total_amount)}</span>
              </div>
            </div>

            {data.invoice.payment_status === 'Paid' && (
              <div style={{textAlign:'center'}}>
                <div className="receipt-stamp">PAID & VERIFIED · {data.invoice.payment_method || 'CASH / TELEBIRR'}</div>
                <div className="muted" style={{fontSize:11,marginTop:6}}>Official Receipt: {data.invoice.receipt_number}</div>
              </div>
            )}
          </div>

          <div className="row-actions no-print" style={{marginTop:20,justifyContent:'space-between'}}>
            <button className="btn" onClick={handlePrint}><Printer size={16}/> Print Document</button>
            <button className="btn btn-outline" onClick={close}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RecordPaymentModal({ booking, close, onSaved }) {
  const [method, setMethod] = useState(booking.payment_preference || 'Cash');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(booking.invoice_total || booking.reported_amount || 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/invoices/record-payment', {
        bookingId: booking.id,
        method,
        reference,
        amount: Number(amount)
      });
      onSaved();
      close();
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Record Payment & Issue Receipt · #${booking.id}`} close={close}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Amount Due (ETB)</label>
          <input className="input" type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}/>
        </div>
        <fieldset className="field payment-method-field">
          <legend>{translate("Payment method")}</legend>
          <div className="payment-method-options">
            {paymentMethods.map(m => (
              <label key={m} className={`payment-method-option ${method === m ? 'selected' : ''}`}>
                <input type="radio" name="record-payment-method" value={m} checked={method === m} onChange={e => setMethod(e.target.value)}/>
                <span>{translate(m)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label>Transaction Reference / Bank Confirmation code</label>
          <input className="input" placeholder="e.g. Telebirr Txn ID or CBE Slip #" value={reference} onChange={e => setReference(e.target.value)}/>
        </div>
        <ErrorMessage message={error}/>
        <div className="row-actions" style={{marginTop:16}}>
          <button className="btn" disabled={busy}>{busy ? 'Processing…' : 'Confirm Payment & Generate Receipt'}</button>
          <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerPaymentModal({ booking, close, onSaved }) {
  const [form, setForm] = useState({ method: booking.payment_method || booking.payment_preference || 'Cash', reference: booking.payment_reference || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={`Choose payment method · #${booking.id}`} close={close}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const { data } = await api.post('/payments/request', { ...form, bookingId: booking.id });
          onSaved(data);
          close();
        } catch (err) {
          setError(explainError(err));
        } finally {
          setBusy(false);
        }
      }}>
        <div className="field">
          <div>
            <strong>{translate("Amount due")}: {money(booking.invoice_total ?? booking.reported_amount ?? booking.estimate)}</strong>
            <p className="muted payment-help">{translate("The provider will confirm this payment method. This does not charge money online.")}</p>
          </div>
        </div>
        <fieldset className="field payment-method-field">
          <legend>{translate("Payment method")}</legend>
          <div className="payment-method-options">
            {paymentMethods.map(method => (
              <label key={method} className={`payment-method-option ${form.method === method ? 'selected' : ''}`}>
                <input type="radio" name={`customer-payment-method-${booking.id}`} value={method} checked={form.method === method} onChange={e => setForm({...form, method: e.target.value})}/>
                <span>{translate(method)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`customer-payment-reference-${booking.id}`}>{translate("Reference (optional)")}</label>
          <input id={`customer-payment-reference-${booking.id}`} className="input" maxLength="120" placeholder="e.g. Telebirr code or Bank reference" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})}/>
        </div>
        <ErrorMessage message={error}/>
        <button className="btn" disabled={busy}>{busy ? translate("Submitting…") : translate("Submit payment method")}</button>
      </form>
    </Modal>
  );
}

// ==========================================
// SPARE PARTS INVENTORY
// ==========================================

function InventoryPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const { data: inventory, error, setData } = useLoad(`/inventory?search=${encodeURIComponent(search)}${lowStockOnly ? '&lowStock=true' : ''}`, [search, lowStockOnly]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);

  if (!user) return <Page title={translate("Spare Parts Inventory")}><SignInPrompt/></Page>;

  const totalValue = inventory?.reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity_in_stock), 0) || 0;
  const lowStockCount = inventory?.filter(item => item.quantity_in_stock <= item.min_stock_level).length || 0;

  const deletePart = async (id) => {
    if (!confirm('Delete this spare part from catalog?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      setData(inventory.filter(p => p.id !== id));
    } catch (e) {
      alert(explainError(e));
    }
  };

  return (
    <Page
      title={translate("Spare Parts Inventory")}
      subtitle="Automated stock updates, parts tracking, and Ethiopian automotive catalog management."
      action={
        ['admin', 'provider', 'cashier'].includes(user.role) && (
          <button className="btn" onClick={() => setAddModalOpen(true)}>
            <Plus size={16}/> {translate("Add Spare Part")}
          </button>
        )
      }
    >
      <PageBanner
        module="inventory"
        title="Spare Parts Inventory"
        subtitle="Track stock levels, set minimum alerts, and manage automotive part catalogs."
        action={['admin', 'provider', 'cashier'].includes(user.role) ? <button className="btn" style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.3)'}} onClick={() => setAddModalOpen(true)}><Plus size={15}/> Add Part</button> : null}
      />
      <div className="stats">
        <Stat label="Total Catalog Items" value={inventory?.length ?? '—'} icon={Package}/>
        <Stat label="Low Stock Warnings" value={lowStockCount} icon={AlertTriangle}/>
        <Stat label="Total Inventory Value" value={money(totalValue)} icon={CreditCard}/>
      </div>

      <div className="card filters" style={{gridTemplateColumns:'1fr auto'}}>
        <input className="input" placeholder="Search by name, part number, or category..." value={search} onChange={e => setSearch(e.target.value)}/>
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)}/>
          <AlertTriangle size={15} color="#d32f2f"/> Low Stock Only
        </label>
      </div>

      <ErrorMessage message={error}/>
      {inventory === null ? <LoadBlock/> : inventory.length === 0 ? (
        <Empty icon={Package} title="No spare parts found" text="Add spare parts to manage stock and track repair consumption."/>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{translate("Part Number")}</th>
                <th>Name / Description</th>
                <th>Category</th>
                <th>{translate("Unit Price")}</th>
                <th>{translate("In Stock")}</th>
                <th>Min Level</th>
                <th>Supplier</th>
                <th>{translate("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(part => {
                const isLow = part.quantity_in_stock <= part.min_stock_level;
                return (
                  <tr key={part.id}>
                    <td><strong>{part.part_number}</strong></td>
                    <td>
                      <div><strong>{part.name}</strong></div>
                      {part.description && <div className="muted" style={{fontSize:12}}>{part.description}</div>}
                    </td>
                    <td><span className="pill">{part.category}</span></td>
                    <td>{money(part.unit_price)}</td>
                    <td>
                      <span style={{fontWeight:700,color:isLow ? '#d32f2f' : '#13835f'}}>
                        {part.quantity_in_stock}
                      </span>
                      {isLow && <span className="low-stock-tag" style={{marginLeft:6}}><AlertTriangle size={11}/> Low</span>}
                    </td>
                    <td>{part.min_stock_level}</td>
                    <td>{part.supplier || '—'}</td>
                    <td>
                      {['admin', 'provider', 'cashier'].includes(user.role) && (
                        <div className="row-actions">
                          <button className="btn btn-outline btn-small" onClick={() => setEditingPart(part)}><Pencil size={13}/> Edit</button>
                          <button className="btn btn-danger btn-small" onClick={() => deletePart(part.id)}><Trash2 size={13}/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(addModalOpen || editingPart) && (
        <PartFormModal
          part={editingPart}
          close={() => { setAddModalOpen(false); setEditingPart(null); }}
          onSaved={() => window.location.reload()}
        />
      )}
    </Page>
  );
}

function PartFormModal({ part, close, onSaved }) {
  const isEdit = Boolean(part);
  const [form, setForm] = useState({
    partNumber: part?.part_number || '',
    name: part?.name || '',
    category: part?.category || 'Brake System',
    unitPrice: part?.unit_price || 0,
    quantityInStock: part?.quantity_in_stock ?? 10,
    minStockLevel: part?.min_stock_level ?? 5,
    supplier: part?.supplier || '',
    description: part?.description || ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = ['Brake System', 'Filters', 'Ignition', 'Fluids & Lubricants', 'Electrical', 'Belts & Cooling', 'Suspension', 'Engine Parts', 'Body & Glass', 'Tires & Wheels', 'Other'];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/inventory/${part.id}`, form);
      } else {
        await api.post('/inventory', form);
      }
      onSaved();
      close();
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit Part · ${part.part_number}` : 'Add New Spare Part'} close={close}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>{translate("Part Number")}</label>
            <input className="input" required value={form.partNumber} onChange={e => setForm({...form, partNumber: e.target.value})}/>
          </div>
          <div className="field">
            <label>Category</label>
            <select className="select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Part Name</label>
          <input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{translate("Unit Price")} (ETB)</label>
            <input className="input" type="number" step="0.01" min="0" required value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})}/>
          </div>
          <div className="field">
            <label>{translate("In Stock")}</label>
            <input className="input" type="number" min="0" required value={form.quantityInStock} onChange={e => setForm({...form, quantityInStock: e.target.value})}/>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Min Stock Warning Level</label>
            <input className="input" type="number" min="0" required value={form.minStockLevel} onChange={e => setForm({...form, minStockLevel: e.target.value})}/>
          </div>
          <div className="field">
            <label>Supplier / Importer</label>
            <input className="input" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}/>
          </div>
        </div>
        <div className="field">
          <label>Description & Vehicle Fitment</label>
          <textarea className="textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
        </div>
        <ErrorMessage message={error}/>
        <div className="row-actions" style={{marginTop:16}}>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Spare Part'}</button>
          <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// GARAGE EQUIPMENT & DIAGNOSTIC DEVICES
// ==========================================

function EquipmentPage() {
  const { user } = useAuth();
  const { data: equipment, error, setData } = useLoad('/equipment', []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  if (!user) return <Page title={translate("Garage Equipment")}><SignInPrompt/></Page>;

  const deleteEquipment = async (id) => {
    if (!confirm('Delete this equipment from registry?')) return;
    try {
      await api.delete(`/equipment/${id}`);
      setData(equipment.filter(e => e.id !== id));
    } catch (e) {
      alert(explainError(e));
    }
  };

  return (
    <Page
      title={translate("Garage Equipment")}
      subtitle="Track diagnostic scanners, vehicle lifts, wheel balancers, and calibration schedules."
      action={
        ['admin', 'provider'].includes(user.role) && (
          <button className="btn" onClick={() => setModalOpen(true)}>
            <Plus size={16}/> {translate("Register Equipment")}
          </button>
        )
      }
    >
      <PageBanner
        module="equipment"
        title="Garage Equipment & Diagnostics"
        subtitle="Manage lift bays, OBD scanners, balancers, and calibration service schedules."
        action={['admin', 'provider'].includes(user.role) ? <button className="btn" style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.3)'}} onClick={() => setModalOpen(true)}><Plus size={15}/> Register</button> : null}
      />

      <ErrorMessage message={error}/>
      {equipment === null ? <LoadBlock/> : equipment.length === 0 ? (
        <Empty icon={Cpu} title="No equipment registered" text="Register diagnostic tools and garage machines to track service schedules."/>
      ) : (
        <div className="grid grid-3">
          {equipment.map(item => (
            <article className="card" key={item.id}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <span className="pill">{item.device_type}</span>
                  <h3 style={{margin:'8px 0 4px'}}>{item.name}</h3>
                  <div className="muted" style={{fontSize:12}}>Model: {item.model_number || 'N/A'} · S/N: {item.serial_number || 'N/A'}</div>
                </div>
                <span className={`equipment-badge ${item.status === 'Operational' ? 'operational' : item.status === 'Maintenance Required' ? 'maintenance' : item.status === 'Under Repair' ? 'repair' : 'calibrated'}`}>
                  {item.status}
                </span>
              </div>
              <p className="muted" style={{fontSize:13,marginTop:12}}>{item.notes || 'Fully certified for shop use.'}</p>
              <div style={{borderTop:'1px solid #edf0f1',paddingTop:10,fontSize:12,color:'#526676'}}>
                <div>Last Serviced: {item.last_service_date ? new Date(item.last_service_date).toLocaleDateString(getDateLocale()) : '—'}</div>
                <div>Next Service Due: <strong>{item.next_service_due ? new Date(item.next_service_due).toLocaleDateString(getDateLocale()) : '—'}</strong></div>
                {item.assigned_mechanic_name && <div style={{color:'#13835f',marginTop:4}}>Assigned: {item.assigned_mechanic_name}</div>}
              </div>
              {['admin', 'provider', 'mechanic'].includes(user.role) && (
                <div className="row-actions" style={{marginTop:14}}>
                  <button className="btn btn-outline btn-small" onClick={() => setEditingItem(item)}><Pencil size={13}/> Edit Status</button>
                  {['admin', 'provider'].includes(user.role) && (
                    <button className="btn btn-danger btn-small" onClick={() => deleteEquipment(item.id)}><Trash2 size={13}/></button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {(modalOpen || editingItem) && (
        <EquipmentFormModal
          item={editingItem}
          close={() => { setModalOpen(false); setEditingItem(null); }}
          onSaved={() => window.location.reload()}
        />
      )}
    </Page>
  );
}

function EquipmentFormModal({ item, close, onSaved }) {
  const isEdit = Boolean(item);
  const { data: mechanics } = useLoad('/mechanics', []);
  const [form, setForm] = useState({
    name: item?.name || '',
    modelNumber: item?.model_number || '',
    serialNumber: item?.serial_number || '',
    deviceType: item?.device_type || 'Diagnostic Scanner',
    status: item?.status || 'Operational',
    lastServiceDate: item?.last_service_date ? item.last_service_date.slice(0, 10) : '',
    nextServiceDue: item?.next_service_due ? item.next_service_due.slice(0, 10) : '',
    assignedTo: item?.assigned_to || '',
    notes: item?.notes || ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const deviceTypes = [
    'Diagnostic Scanner', 'Hydraulic Lift', 'Wheel Balancer', 'AC Recovery',
    'Battery Tester', 'Welding & Cutting', 'Engine Crane', 'Hand & Power Tools', 'Other'
  ];
  const statuses = ['Operational', 'Maintenance Required', 'Under Repair', 'Calibrated', 'Decommissioned'];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/equipment/${item.id}`, form);
      } else {
        await api.post('/equipment', form);
      }
      onSaved();
      close();
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit Equipment · ${item.name}` : 'Register Garage Equipment'} close={close}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Equipment / Device Name</label>
          <input className="input" required placeholder="e.g. Launch X431 Pro Diagnostic Scanner" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Device Type</label>
            <select className="select" value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value})}>
              {deviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Current Status</label>
            <select className="select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Model Number</label>
            <input className="input" value={form.modelNumber} onChange={e => setForm({...form, modelNumber: e.target.value})}/>
          </div>
          <div className="field">
            <label>Serial Number</label>
            <input className="input" value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})}/>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Last Serviced / Calibrated</label>
            <input className="input" type="date" value={form.lastServiceDate} onChange={e => setForm({...form, lastServiceDate: e.target.value})}/>
          </div>
          <div className="field">
            <label>Next Service Due</label>
            <input className="input" type="date" value={form.nextServiceDue} onChange={e => setForm({...form, nextServiceDue: e.target.value})}/>
          </div>
        </div>
        <div className="field">
          <label>Assign to Responsible Mechanic</label>
          <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
            <option value="">-- No specific mechanic --</option>
            {mechanics?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Maintenance Notes & Specifications</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>
        </div>
        <ErrorMessage message={error}/>
        <div className="row-actions" style={{marginTop:16}}>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Equipment'}</button>
          <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// ROADSIDE ASSISTANCE
// ==========================================

function Roadside() {
  const { user } = useAuth();
  if (!user) return <Page title={translate("Roadside assistance")}><SignInPrompt/></Page>;
  if (user.role === 'provider') return <ProviderRoadside/>;
  if (user.role === 'admin') return <AdminRoadside/>;
  return <RoadsideContent user={user}/>;
}

function ProviderRoadside() {
  const { user } = useAuth();
  const { data: requests, error, setData } = useLoad('/roadside', [user?.id]);
  const [message, setMessage] = useState('');

  const update = async (id, status) => {
    try {
      const { data } = await api.patch(`/roadside/${id}/status`, { status });
      setData(requests.map(r => r.id === id ? { ...r, ...data } : r));
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  return (
    <Page title={translate("Roadside requests")} subtitle="Respond to drivers and keep them updated while you provide assistance.">
      <ErrorMessage message={error || message}/>
      {requests === null ? <LoadBlock/> : requests.length === 0 ? (
        <Empty icon={Truck} title={translate("No open roadside requests")}/>
      ) : (
        <div className="grid">
          {requests.map(r => (
            <article className="card" key={r.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                <h3>{r.problem_type} · {r.make} {r.model} ({r.plate_number})</h3>
                <Status status={r.status}/>
              </div>
              <p className="muted">{r.description}</p>
              {r.landmark && <p><strong>{translate("Landmark")}:</strong> {r.landmark}</p>}
              <p className="muted">{translate("Preferred method")}: <strong>{translate(r.payment_preference || 'Cash')}</strong></p>
              <div className="provider-meta">
                <span>
                  <MapPin size={14}/>
                  <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.location)}`} target="_blank" rel="noreferrer">
                    {r.location}
                  </a>
                </span>
                <span><Clock3 size={14}/>{new Date(r.requested_at).toLocaleString(getDateLocale())}</span>
              </div>
              <div className="row-actions" style={{marginTop:15}}>
                <a className="btn btn-outline btn-small" href={`tel:${r.customer_phone}`}><Activity size={14}/>{translate("Call ")}{r.customer_phone}</a>
                {r.status === 'Pending' && (
                  <>
                    <button className="btn btn-small" onClick={() => update(r.id, 'Accepted')}>{translate("Accept request")}</button>
                    <button className="btn btn-danger btn-small" onClick={() => update(r.id, 'Rejected')}>{translate("Reject")}</button>
                  </>
                )}
                {r.status === 'Accepted' && <button className="btn btn-small" onClick={() => update(r.id, 'In Progress')}>{translate("Start assistance")}</button>}
                {r.status === 'In Progress' && <button className="btn btn-small" onClick={() => update(r.id, 'Completed')}>{translate("Mark completed")}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function AdminRoadside() {
  const { data: requests, error, setData } = useLoad('/roadside', []);
  const [message, setMessage] = useState('');

  const update = async (id, status) => {
    try {
      const { data } = await api.patch(`/roadside/${id}/status`, { status });
      setData(requests.map(r => r.id === id ? { ...r, ...data } : r));
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  return (
    <Page title={translate("Roadside requests")} subtitle="Monitor assistance requests and their current status.">
      <ErrorMessage message={error || message}/>
      {requests === null ? <LoadBlock/> : requests.length === 0 ? (
        <Empty icon={Truck} title={translate("No roadside requests")}/>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{translate("Request")}</th>
                <th>{translate("Customer")}</th>
                <th>{translate("Location & Landmark")}</th>
                <th>{translate("Provider")}</th>
                <th>{translate("Payment method")}</th>
                <th>{translate("Status")}</th>
                <th>{translate("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.problem_type}<div className="muted">{r.make} {r.model}</div></td>
                  <td>{r.customer_name}<div><a className="inline-link" href={`tel:${r.customer_phone}`}>{r.customer_phone}</a></div></td>
                  <td>
                    <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.location)}`} target="_blank" rel="noreferrer">
                      {r.location}
                    </a>
                    {r.landmark && <div className="muted">Landmark: {r.landmark}</div>}
                  </td>
                  <td>{r.business_name || 'Unassigned'}</td>
                  <td>{translate(r.payment_preference || 'Cash')}</td>
                  <td><Status status={r.status}/></td>
                  <td>
                    {r.status === 'Pending' && <button className="btn btn-small" onClick={() => update(r.id, 'Accepted')}>{translate("Accept")}</button>}
                    {r.status === 'Accepted' && <button className="btn btn-small" onClick={() => update(r.id, 'In Progress')}>{translate("In progress")}</button>}
                    {r.status === 'In Progress' && <button className="btn btn-small" onClick={() => update(r.id, 'Completed')}>{translate("Complete")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function RoadsideContent({ user }) {
  const { data: vehicles, error: vehicleError } = useLoad('/vehicles', [user?.id]);
  const { data: providers } = useLoad('/providers', [user?.id]);
  const [form, setForm] = useState({ vehicleId: '', location: '', landmark: '', phone: user?.phone || '', problemType: 'Vehicle breakdown', description: '', providerId: '', paymentPreference: 'Cash' });
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = () => api.get('/roadside').then(({ data }) => setRequests(data)).catch(e => setError(explainError(e)));
  useEffect(() => { loadRequests(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/roadside', { ...form, vehicleId: Number(form.vehicleId), providerId: form.providerId ? Number(form.providerId) : undefined });
      setSuccess('Your roadside assistance request was sent.');
      setForm({ ...form, description: '', landmark: '' });
      loadRequests();
    } catch (e) {
      setError(explainError(e));
    }
  };

  const statusUpdate = async (id, status) => {
    try {
      await api.patch(`/roadside/${id}/status`, { status });
      loadRequests();
    } catch (e) {
      setError(explainError(e));
    }
  };

  return (
    <Page title={translate("Roadside assistance")} subtitle="Tell us where you are and what happened. A verified provider will be dispatched to your location.">
      <PageBanner module="roadside" title="Roadside Assistance" subtitle="Send your GPS location or landmark and get help from a nearby verified provider."/>

      <div className="grid grid-3">
        <form className="card" onSubmit={submit}>
          <h3>{translate("Request roadside help")}</h3>
          {vehicleError && <ErrorMessage message={vehicleError}/>}
          {!vehicles?.length ? (
            <div className="alert alert-error">
              {translate("Add your vehicle before requesting roadside assistance. ")}
              <Link className="inline-link" to="/vehicles">{translate("Add vehicle")}</Link>
            </div>
          ) : (
            <>
              <div className="field">
                <label>{translate("Vehicle")}</label>
                <select className="select" required value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})}>
                  <option value="">{translate("Choose vehicle")}</option>
                  {vehicles?.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plate_number}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{translate("Current location")}</label>
                <input className="input" required placeholder="Area, road, or GPS link (e.g. Bole Medhanialem Road)" value={form.location} onChange={e => setForm({...form, location: e.target.value})}/>
              </div>
              <div className="field">
                <label>{translate("Landmark")}</label>
                <input className="input" placeholder="Nearby recognizable building/landmark (e.g. In front of Edna Mall)" value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})}/>
              </div>
              <div className="field">
                <label>{translate("Phone number")}</label>
                <input className="input" required type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
              </div>
              <div className="field">
                <label>{translate("Problem type")}</label>
                <select className="select" value={form.problemType} onChange={e => setForm({...form, problemType: e.target.value})}>
                  {['Vehicle breakdown', 'Flat tire', 'Dead battery', 'Engine problem', 'Accident assistance', 'Fuel problem', 'Towing'].map(x => <option key={x}>{translate(x)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{translate("Preferred provider (optional)")}</label>
                <select className="select" value={form.providerId} onChange={e => setForm({...form, providerId: e.target.value})}>
                  <option value="">{translate("Any available verified provider")}</option>
                  {providers?.map(p => <option key={p.id} value={p.id}>{p.business_name} · {p.location}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{translate("Describe the situation")}</label>
                <textarea className="textarea" required minLength="5" value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
              </div>
              <fieldset className="field payment-method-field">
                <legend>{translate("Preferred payment method")}</legend>
                <div className="payment-method-options">
                  {paymentMethods.map(m => (
                    <label key={m} className={`payment-method-option ${form.paymentPreference === m ? 'selected' : ''}`}>
                      <input type="radio" name="roadside-payment" value={m} checked={form.paymentPreference === m} onChange={e => setForm({...form, paymentPreference: e.target.value})}/>
                      <span>{translate(m)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <ErrorMessage message={error}/>
              {success && <div className="alert alert-success">{success}</div>}
              <button className="btn"><Truck size={16}/>{translate("Send assistance request")}</button>
            </>
          )}
        </form>

        <div style={{gridColumn:'span 2'}}>
          <h3 style={{color:'#102a43'}}>{translate("Your assistance requests")}</h3>
          {error && <ErrorMessage message={error}/>}
          {requests === null ? <LoadBlock/> : requests.length === 0 ? (
            <Empty icon={Truck} title={translate("No roadside requests")} text="Requests you submit will be tracked here."/>
          ) : (
            <div className="grid">
              {requests.map(r => (
                <article className="card" key={r.id}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                    <h3>{translate(r.problem_type)} · {r.make} {r.model}</h3>
                    <Status status={r.status}/>
                  </div>
                  <p className="muted">{r.description}</p>
                  {r.landmark && <p><strong>{translate("Landmark")}:</strong> {r.landmark}</p>}
                  <div className="provider-meta">
                    <span><MapPin size={14}/>{r.location}</span>
                    <span><Clock3 size={14}/>{new Date(r.requested_at).toLocaleString(getDateLocale())}</span>
                  </div>
                  <p className="muted" style={{marginTop:12}}>
                    {translate("Preferred method")}: <strong>{translate(r.payment_preference || 'Cash')}</strong>
                  </p>
                  {r.business_name && <p style={{marginTop:8}}><strong>Provider: {r.business_name}</strong></p>}
                  {r.provider_phone && (
                    <a className="btn btn-outline btn-small" style={{marginTop:8}} href={`tel:${r.provider_phone}`}>
                      <Activity size={14}/>{translate("Call provider")}
                    </a>
                  )}
                  {r.status === 'Pending' && (
                    <button className="btn btn-small btn-danger" style={{marginTop:8}} onClick={() => statusUpdate(r.id, 'Cancelled')}>
                      {translate("Cancel request")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ==========================================
// NOTIFICATIONS & REVIEWS
// ==========================================

function Notifications() {
  const { user } = useAuth();
  const { data: items, error, setData } = useLoad('/notifications', [user?.id]);
  if (!user) return <Page title={translate("Notifications")}><SignInPrompt/></Page>;

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/notifications/${id}/read`);
      setData(items.map(n => n.id === id ? data : n));
    } catch {}
  };

  return (
    <Page title={translate("Notifications")} subtitle="Updates about your repairs, parts stock alerts, and service requests.">
      {error && <ErrorMessage message={error}/>}
      {items === null ? <LoadBlock/> : items.length === 0 ? (
        <Empty icon={Bell} title={translate("You're all caught up")} text="Important updates will appear here."/>
      ) : (
        <div className="grid">
          {items.map(n => (
            <article className={`card notice ${!n.read_at ? 'unread' : ''}`} key={n.id}>
              <Bell size={19} color="#1d9b70"/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                  <h3>{n.title}</h3>
                  {!n.read_at && <span className="badge badge-green">{translate("New")}</span>}
                </div>
                <p className="muted">{n.message}</p>
                <span className="muted" style={{fontSize:12}}>{new Date(n.created_at).toLocaleString(getDateLocale())}</span>
              </div>
              {!n.read_at && <button className="btn btn-outline btn-small" onClick={() => markRead(n.id)}>{translate("Mark read")}</button>}
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function Payments() {
  const { user } = useAuth();
  const { data, error } = useLoad('/payments', [user?.id]);
  if (!user) return <Page title={translate("Payment history")}><SignInPrompt/></Page>;

  return (
    <Page title={translate("Payment history")} subtitle="Payment records and confirmed transactions for repair work.">
      {error && <ErrorMessage message={error}/>}
      {data === null ? <LoadBlock/> : data.length === 0 ? (
        <Empty icon={CreditCard} title={translate("No payments recorded")} text="Completed repair payments will appear here."/>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{translate("Payment")}</th>
                <th>{translate("Booking")}</th>
                <th>{['provider', 'cashier', 'admin'].includes(user.role) ? 'Customer' : 'Provider'}</th>
                <th>Vehicle</th>
                <th>{translate("Method")}</th>
                <th>Reference</th>
                <th>{translate("Date")}</th>
                <th>{translate("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id}>
                  <td><strong>{money(p.amount)}</strong></td>
                  <td>#{p.booking_id}</td>
                  <td>{['provider', 'cashier', 'admin'].includes(user.role) ? p.customer_name : p.business_name}</td>
                  <td>{p.make} {p.model} ({p.plate_number})</td>
                  <td><span className="pill">{translate(p.method)}</span></td>
                  <td>{p.reference || '—'}</td>
                  <td>{new Date(p.paid_at || p.created_at).toLocaleDateString(getDateLocale())}</td>
                  <td><Status status={p.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function Reviews() {
  const { user } = useAuth();
  const { data, error } = useLoad('/reviews', [user?.id]);
  if (!user) return <Page title={translate("Reviews")}><SignInPrompt/></Page>;

  return (
    <Page title={user.role === 'provider' ? 'Customer reviews' : 'My reviews'} subtitle="Feedback and ratings on completed repair work.">
      {error && <ErrorMessage message={error}/>}
      {data === null ? <LoadBlock/> : data.length === 0 ? (
        <Empty icon={Star} title={translate("No reviews yet")} text="Reviews will appear here after a completed service."/>
      ) : (
        <div className="grid grid-3">
          {data.map(r => (
            <article className="card" key={r.id}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <strong>{user.role === 'provider' ? r.customer_name : r.business_name}</strong>
                <span className="rating"><Star fill="currentColor" size={14}/>{r.rating}/5</span>
              </div>
              <p style={{marginTop:16}}>{r.comment || 'No written comment.'}</p>
              <span className="muted" style={{fontSize:12}}>Booking #{r.booking_id} · {new Date(r.created_at).toLocaleDateString(getDateLocale())}</span>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function ReviewModal({ booking, close }) {
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [error, setError] = useState('');

  return (
    <Modal title={`Review repair · #${booking.id}`} close={close}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.post('/reviews', { ...form, bookingId: booking.id });
          close();
          window.location.reload();
        } catch (err) {
          setError(explainError(err));
        }
      }}>
        <div className="field">
          <label>{translate("Rating")}</label>
          <select className="select" value={form.rating} onChange={e => setForm({...form, rating: Number(e.target.value)})}>
            {[5, 4, 3, 2, 1].map(x => <option value={x} key={x}>{x} star{x > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{translate("Your review")}</label>
          <textarea className="textarea" placeholder="Share your experience with this repair..." value={form.comment} onChange={e => setForm({...form, comment: e.target.value})}/>
        </div>
        <ErrorMessage message={error}/>
        <button className="btn">{translate("Submit review")}</button>
      </form>
    </Modal>
  );
}

// ==========================================
// ROLE-AWARE DASHBOARD
// ==========================================

function Dashboard() {
  const { user } = useAuth();
  if (!user) return <Page title={translate("Dashboard")}><SignInPrompt/></Page>;
  if (user.role === 'admin') return <AdminDashboard/>;
  if (user.role === 'provider') return <ProviderDashboard/>;
  if (user.role === 'mechanic') return <MechanicDashboard/>;
  if (user.role === 'cashier') return <CashierDashboard/>;
  return <CustomerDashboard/>;
}

function CustomerDashboard() {
  const { user } = useAuth();
  const { data: bookings } = useLoad('/bookings', [user?.id]);
  const { data: vehicles } = useLoad('/vehicles', [user?.id]);
  const { data: payments } = useLoad('/payments', [user?.id]);

  return (
    <Page title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Your vehicle care, organized in one place." action={<Link className="btn" to="/services">{translate("Book a repair ")}<ArrowRight size={15}/></Link>}>
      <div className="stats">
        <Stat label="My vehicles" value={vehicles?.length ?? '—'} icon={CarFront}/>
        <Stat label="Bookings" value={bookings?.length ?? '—'} icon={ClipboardList}/>
        <Stat label="Active repairs" value={bookings?.filter(b => ['Accepted', 'Scheduled', 'In Progress'].includes(b.status)).length ?? '—'} icon={Wrench}/>
        <Stat label="Payments" value={payments?.length ?? '—'} icon={CreditCard}/>
      </div>
      <div className="grid grid-3">
        <Link to="/vehicles" className="card service-card" style={{textDecoration:'none'}}>
          <CarFront color="#1d9b70"/>
          <h3>{translate("Manage vehicles")}</h3>
          <p>Add or update your vehicles and view complete service history.</p>
        </Link>
        <Link to="/bookings" className="card service-card" style={{textDecoration:'none'}}>
          <ClipboardList color="#1d9b70"/>
          <h3>{translate("Track repairs")}</h3>
          <p>See appointment status, assigned mechanic, and service progress.</p>
        </Link>
        <Link to="/invoices" className="card service-card" style={{textDecoration:'none'}}>
          <FileText color="#1d9b70"/>
          <h3>{translate("Invoices & Receipts")}</h3>
          <p>View detailed cost breakdowns, Ethiopian 15% VAT, and printable receipts.</p>
        </Link>
      </div>
    </Page>
  );
}

function MechanicDashboard() {
  const { user } = useAuth();
  const { data: bookings } = useLoad('/bookings', [user?.id]);
  const { data: equipment } = useLoad('/equipment', [user?.id]);
  const { data: inventory } = useLoad('/inventory', [user?.id]);

  const activeRepairs = bookings?.filter(b => ['Accepted', 'Scheduled', 'In Progress'].includes(b.status)) || [];

  return (
    <Page title={`Mechanic Dashboard · ${user.name}`} subtitle="Your repair assignments, diagnostic tools, and spare parts catalog.">
      <div className="stats">
        <Stat label="Assigned Jobs" value={bookings?.length ?? '—'} icon={ClipboardList}/>
        <Stat label="In Progress" value={bookings?.filter(b => b.status === 'In Progress').length ?? '—'} icon={Wrench}/>
        <Stat label="Completed" value={bookings?.filter(b => b.status === 'Completed').length ?? '—'} icon={Check}/>
        <Stat label="Diagnostic Devices" value={equipment?.length ?? '—'} icon={Cpu}/>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{gridColumn:'span 2'}}>
          <h3>Active Repair Assignments</h3>
          {activeRepairs.length === 0 ? (
            <p className="muted">No jobs currently in progress or awaiting repair.</p>
          ) : (
            <div className="grid">
              {activeRepairs.map(b => (
                <div key={b.id} style={{border:'1px solid #edf0f1',padding:14,borderRadius:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <strong>Booking #{b.id} · {b.year} {b.make} {b.model} ({b.plate_number})</strong>
                      <div className="muted">{b.service_name} · Customer: {b.customer_name} ({b.customer_phone})</div>
                      <div style={{marginTop:4,fontSize:13}}>{b.problem_description}</div>
                    </div>
                    <Status status={b.status}/>
                  </div>
                  <div style={{marginTop:12}}>
                    <Link to="/bookings" className="btn btn-small">Manage & Submit Report <ArrowRight size={13}/></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Quick Links</h3>
          <div className="grid">
            <Link to="/bookings" className="btn btn-outline"><Wrench size={16}/> All Assigned Repairs</Link>
            <Link to="/inventory" className="btn btn-outline"><Package size={16}/> Check Spare Parts</Link>
            <Link to="/equipment" className="btn btn-outline"><Cpu size={16}/> Diagnostic Scanners & Tools</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}

function CashierDashboard() {
  const { user } = useAuth();
  const { data: invoices } = useLoad('/invoices', [user?.id]);
  const { data: payments } = useLoad('/payments', [user?.id]);
  const { data: inventory } = useLoad('/inventory', [user?.id]);

  const unpaidInvoices = invoices?.filter(i => i.payment_status === 'Unpaid') || [];
  const totalCollected = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return (
    <Page title={`Cashier Dashboard · ${user.name}`} subtitle="Manage billing, record customer payments, and issue official receipts.">
      <div className="stats">
        <Stat label="Unpaid Invoices" value={unpaidInvoices.length} icon={Clock3}/>
        <Stat label="Recorded Receipts" value={payments?.length ?? '—'} icon={CreditCard}/>
        <Stat label="Total Payments Collected" value={money(totalCollected)} icon={CreditCard}/>
        <Stat label="Spare Parts Items" value={inventory?.length ?? '—'} icon={Package}/>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{gridColumn:'span 2'}}>
          <h3>Pending Invoices Awaiting Payment</h3>
          {unpaidInvoices.length === 0 ? (
            <p className="muted">All customer invoices have been collected and verified!</p>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Total (ETB)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.slice(0, 5).map(inv => (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoice_number}</strong></td>
                      <td>{inv.customer_name}</td>
                      <td>{inv.make} {inv.model} ({inv.plate_number})</td>
                      <td><strong>{money(inv.total_amount)}</strong></td>
                      <td>
                        <Link to="/invoices" className="btn btn-small">Record Payment</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Cashier Quick Actions</h3>
          <div className="grid">
            <Link to="/invoices" className="btn btn-outline"><FileText size={16}/> All Invoices & Receipts</Link>
            <Link to="/payments" className="btn btn-outline"><CreditCard size={16}/> Payment Records</Link>
            <Link to="/inventory" className="btn btn-outline"><Package size={16}/> Inventory Stock Check</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">{translate(label)}<Icon size={17}/></div>
      <div className="stat-number">{value}</div>
    </div>
  );
}

function ProviderDashboard() {
  const { user } = useAuth();
  const { data: profile, setData: setProfile } = useLoad('/providers/me', [user?.id]);
  const { data: bookings } = useLoad('/bookings', [user?.id]);
  const { data: categories } = useLoad('/categories', [user?.id]);
  const [error, setError] = useState('');
  const [serviceForm, setServiceForm] = useState({ categoryId: '', name: '', description: '', price: '', estimatedMinutes: 60 });
  const [profileForm, setProfileForm] = useState(null);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        businessName: profile.business_name,
        providerType: profile.provider_type,
        location: profile.location,
        experienceYears: profile.experience_years,
        specialties: profile.specialties || [],
        bio: profile.bio || ''
      });
    }
  }, [profile]);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/providers/me', profileForm);
      setProfile(data);
    } catch (e) {
      setError(explainError(e));
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    try {
      await api.post('/services', serviceForm);
      setServiceForm({ categoryId: '', name: '', description: '', price: '', estimatedMinutes: 60 });
      setError('Service added successfully.');
    } catch (e) {
      setError(explainError(e));
    }
  };

  if (profile === null) return <Page title={translate("Provider dashboard")}><LoadBlock/></Page>;

  return (
    <Page title={`Provider dashboard · ${profile.business_name}`} subtitle="Manage your garage profile, bookings, mechanic assignments, inventory, and services.">
      <div className="stats">
        <Stat label="Verification" value={profile.verified ? 'Verified' : 'Pending'} icon={ShieldCheck}/>
        <Stat label="Bookings" value={bookings?.length ?? '—'} icon={ClipboardList}/>
        <Stat label="Awaiting response" value={bookings?.filter(b => b.status === 'Pending').length ?? '—'} icon={Clock3}/>
        <Stat label="Completed" value={bookings?.filter(b => b.status === 'Completed').length ?? '—'} icon={Check}/>
      </div>
      {!profile.verified && (
        <div className="alert alert-error">{translate("Your profile is awaiting administrator verification. You can update your profile, but cannot publish services until it is verified.")}</div>
      )}
      <ErrorMessage message={error}/>

      <div className="grid grid-3">
        <form className="card" onSubmit={saveProfile}>
          <h3>{translate("Provider profile")}</h3>
          {profileForm && (
            <>
              <div className="field"><label>{translate("Business name")}</label><input className="input" required value={profileForm.businessName} onChange={e => setProfileForm({...profileForm, businessName: e.target.value})}/></div>
              <div className="field"><label>{translate("Location")}</label><input className="input" required value={profileForm.location} onChange={e => setProfileForm({...profileForm, location: e.target.value})}/></div>
              <div className="field"><label>{translate("Experience (years)")}</label><input className="input" type="number" min="0" value={profileForm.experienceYears} onChange={e => setProfileForm({...profileForm, experienceYears: e.target.value})}/></div>
              <div className="field"><label>{translate("Specialties (comma separated)")}</label><input className="input" value={profileForm.specialties.join(', ')} onChange={e => setProfileForm({...profileForm, specialties: e.target.value.split(',').map(x => x.trim()).filter(Boolean)})}/></div>
              <div className="field"><label>{translate("About your services")}</label><textarea className="textarea" value={profileForm.bio} onChange={e => setProfileForm({...profileForm, bio: e.target.value})}/></div>
              <button className="btn">{translate("Save profile")}</button>
            </>
          )}
        </form>

        <form className="card" onSubmit={addService}>
          <h3>{translate("Publish a repair service")}</h3>
          <div className="field">
            <label>{translate("Category")}</label>
            <select className="select" required value={serviceForm.categoryId} onChange={e => setServiceForm({...serviceForm, categoryId: e.target.value})}>
              <option value="">{translate("Choose category")}</option>
              {categories?.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>{translate("Service name")}</label><input className="input" required value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})}/></div>
          <div className="field"><label>{translate("Description")}</label><textarea className="textarea" required value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})}/></div>
          <div className="form-grid">
            <div className="field"><label>{translate("Price (ETB)")}</label><input className="input" required type="number" min="0" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: e.target.value})}/></div>
            <div className="field"><label>{translate("Minutes")}</label><input className="input" required type="number" min="1" value={serviceForm.estimatedMinutes} onChange={e => setServiceForm({...serviceForm, estimatedMinutes: e.target.value})}/></div>
          </div>
          <button className="btn" disabled={!profile.verified}>{translate("Publish service")}</button>
        </form>

        <div className="card">
          <h3>Garage Operations</h3>
          <div className="grid">
            <Link to="/bookings" className="btn btn-outline"><ClipboardList size={16}/> Repair Bookings & Mechanic Assignment</Link>
            <Link to="/inventory" className="btn btn-outline"><Package size={16}/> Spare Parts Inventory & Stock Alerts</Link>
            <Link to="/equipment" className="btn btn-outline"><Cpu size={16}/> Garage Equipment & Scanners</Link>
            <Link to="/invoices" className="btn btn-outline"><FileText size={16}/> Invoices & Tax Receipts</Link>
            <Link to="/roadside" className="btn btn-outline"><Truck size={16}/> Roadside Requests</Link>
          </div>
        </div>

        <AvailabilityEditor/>
      </div>
    </Page>
  );
}

function AvailabilityEditor() {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { data: schedule, error, setData } = useLoad('/availability/me', []);
  const [days, setDays] = useState(weekdays.map((_, weekday) => ({ weekday, startTime: '09:00', endTime: '17:00', available: false })));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (schedule) {
      setDays(weekdays.map((_, weekday) => {
        const saved = schedule.find(day => day.weekday === weekday);
        return saved
          ? { weekday, startTime: String(saved.start_time).slice(0, 5), endTime: String(saved.end_time).slice(0, 5), available: saved.available }
          : { weekday, startTime: '09:00', endTime: '17:00', available: false };
      }));
    }
  }, [schedule]);

  const save = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const { data } = await api.put('/availability/me', { days });
      setData(data);
      setMessage('Availability saved.');
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <h3>{translate("Weekly availability")}</h3>
      <p className="muted">{translate("Set the days and hours when customers can request service.")}</p>
      {error && <ErrorMessage message={error}/>}
      {schedule === null ? <LoadBlock/> : (
        <>
          {days.map((day, index) => (
            <div key={day.weekday} className="availability-row">
              <label style={{fontSize:13,fontWeight:700}}>{translate(weekdays[index])}</label>
              <div className="time-inputs">
                <input aria-label={`${translate(weekdays[index])} start`} type="time" className="input" disabled={!day.available} value={day.startTime} onChange={e => setDays(days.map(d => d.weekday === day.weekday ? {...d, startTime: e.target.value} : d))}/>
                <input aria-label={`${translate(weekdays[index])} end`} type="time" className="input" disabled={!day.available} value={day.endTime} onChange={e => setDays(days.map(d => d.weekday === day.weekday ? {...d, endTime: e.target.value} : d))}/>
              </div>
              <label style={{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:12}}>
                <input aria-label={`${translate(weekdays[index])} available`} type="checkbox" checked={day.available} onChange={e => setDays(days.map(d => d.weekday === day.weekday ? {...d, available: e.target.checked} : d))}/>
                {translate(day.available ? 'Open' : 'Off')}
              </label>
            </div>
          ))}
          {message && <div className="alert alert-success">{message}</div>}
          <button className="btn">{translate("Save availability")}</button>
        </>
      )}
    </form>
  );
}

// ==========================================
// ADMIN DASHBOARD & FINANCIAL REPORTS
// ==========================================

function AdminDashboard() {
  const { user: currentUser, updateUser } = useAuth();
  const { data: stats, error, setData: setStats } = useLoad('/admin/dashboard', []);
  const [providers, setProviders] = useState(null);
  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState('');
  const [complaints, setComplaints] = useState(null);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('all');
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    let active = true;
    const requests = [
      api.get('/admin/providers').then(({ data }) => { if (active) setProviders(data); }),
      api.get('/admin/users').then(({ data }) => { if (active) { setUsers(data); setUsersError(''); } }).catch(error => { if (active) setUsersError(explainError(error)); }),
      api.get('/admin/complaints').then(({ data }) => { if (active) setComplaints(data); }),
      api.get('/admin/reports').then(({ data }) => { if (active) setReport(data); })
    ];
    Promise.allSettled(requests).then(results => {
      if (!active) return;
      const failures = results.filter(result => result.status === 'rejected').map(result => explainError(result.reason));
      if (failures.length) setMessage(failures.join(' '));
    });
    return () => { active = false; };
  }, []);

  const verify = async (id, verified) => {
    try {
      const { data } = await api.patch(`/admin/providers/${id}/verify`, { verified });
      setProviders(providers.map(p => p.id === id ? { ...p, ...data } : p));
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  const saveUser = (user) => {
    setUsers(items => items?.map(item => String(item.id) === String(user.id) ? { ...item, ...user } : item));
    if (String(user.id) === String(currentUser.id)) updateUser(user);
    setEditingUser(null);
    setUserError('');
    setUserMessage('User details updated.');
  };

  const reloadUsers = async () => {
    setUsers(null);
    setUsersError('');
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (e) {
      setUsersError(explainError(e));
    }
  };

  const deleteUser = async (account) => {
    if (String(account.id) === String(currentUser.id) || account.role === 'admin') return;
    if (!window.confirm(`Remove ${account.name}'s account details? Their login will be disabled and personal contact details will be removed.`)) return;
    setUserMessage('');
    setUserError('');
    setDeletingUserId(account.id);
    try {
      await api.delete(`/admin/users/${account.id}`);
      setUsers(items => items?.filter(item => String(item.id) !== String(account.id)));
      if (account.role === 'provider') setProviders(items => items?.filter(p => String(p.user_id) !== String(account.id)));
      setUserMessage(`${account.name}'s account details were removed.`);
      try { const { data } = await api.get('/admin/dashboard'); setStats(data); } catch {}
    } catch (e) {
      setUserError(explainError(e));
    } finally {
      setDeletingUserId(null);
    }
  };

  const statsLabels = [
    ['Total Customers', 'customers', UserRound],
    ['Total Vehicles', 'vehicles', CarFront],
    ['Total Mechanics', 'mechanics', Wrench],
    ['Total Cashiers', 'cashiers', CreditCard],
    ['Total Workshops', 'workshops', Activity],
    ['Total Services', 'services', ClipboardList],
    ['Total Bookings', 'bookings', ClipboardList],
    ['Pending Repairs', 'pending_repairs', Clock3],
    ['Completed Repairs', 'completed_repairs', Check],
    ['Roadside Requests', 'roadside_requests', Truck],
    ['Spare Parts Count', 'spare_parts_count', Package],
    ['Low Stock Alerts', 'low_stock_count', AlertTriangle],
    ['Total Equipment', 'equipment_count', Cpu],
    ['Maintenance Due', 'equipment_maintenance_due', AlertTriangle]
  ];

  const dashboardSections = [
    ['admin-overview', 'Overview', Activity],
    ['admin-catalog', 'Catalog management', Wrench],
    ['admin-providers', 'Provider verification', ShieldCheck],
    ['admin-users', 'Users', UserRound],
    ['admin-financials', 'Financial Reports', CreditCard],
    ['admin-complaints', 'Complaints', AlertTriangle],
    ['admin-operations', 'Operations', ClipboardList]
  ];

  const searchQuery = userSearch.trim().toLowerCase();
  const filteredUsers = (users || []).filter(account =>
    (!searchQuery || [account.name, account.email, account.phone].some(value => String(value || '').toLowerCase().includes(searchQuery))) &&
    (userRole === 'all' || account.role === userRole)
  );

  return (
    <Page title={translate("Administrator dashboard")} subtitle="Manage the DERASHE GERAJI automotive service marketplace.">
      <div className="admin-dashboard-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">{translate("Dashboard menu")}</div>
          <nav aria-label={translate("Admin dashboard sections")}>
            {dashboardSections.map(([id, label, Icon]) => (
              <a key={id} href={`#${id}`}><Icon size={17}/><span>{translate(label)}</span></a>
            ))}
          </nav>
        </aside>

        <div className="admin-dashboard-content">
          <ErrorMessage message={error || message}/>
          <section id="admin-overview" className="admin-section">
            <h2>{translate("Overview")}</h2>
            {stats === null ? <LoadBlock/> : (
              <div className="stats">
                {statsLabels.map(([label, key, Icon]) => (
                  <Stat key={key} label={label} value={stats[key] ?? '0'} icon={Icon}/>
                ))}
              </div>
            )}
          </section>

          <AdminCatalog id="admin-catalog"/>

          <section id="admin-providers" className="admin-section">
            <h2>{translate("Provider verification")}</h2>
            {providers === null ? <LoadBlock/> : providers.length === 0 ? (
              <Empty title={translate("No providers registered")}/>
            ) : (
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{translate("Provider")}</th>
                      <th>{translate("Type")}</th>
                      <th>{translate("Location")}</th>
                      <th>{translate("Contact")}</th>
                      <th>{translate("Experience")}</th>
                      <th>{translate("Status")}</th>
                      <th>{translate("Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map(p => (
                      <tr key={p.id}>
                        <td>{p.business_name}<div className="muted">{p.name}</div></td>
                        <td>{translate(p.provider_type)}</td>
                        <td>{p.location}</td>
                        <td><a className="inline-link" href={`tel:${p.phone}`}>{p.phone}</a></td>
                        <td>{p.experience_years}{translate(" years")}</td>
                        <td><Status status={p.verified ? 'Accepted' : 'Pending'}/></td>
                        <td>
                          <button className={`btn btn-small ${p.verified ? 'btn-danger' : ''}`} onClick={() => verify(p.id, !p.verified)}>
                            {translate(p.verified ? 'Revoke' : 'Verify')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section id="admin-users" className="admin-section">
            <h2>{translate("Users")}</h2>
            {userMessage && <div className="alert alert-success">{userMessage}</div>}
            <ErrorMessage message={usersError || userError}/>
            {users === null ? (
              usersError ? <button className="btn btn-outline" onClick={reloadUsers}>{translate("Retry loading users")}</button> : <LoadBlock/>
            ) : (
              <>
                <div className="admin-user-tools">
                  <div className="field">
                    <label htmlFor="admin-user-search">{translate("Search users")}</label>
                    <input id="admin-user-search" className="input" type="search" placeholder={translate("Name, email, or phone")} value={userSearch} onChange={e => setUserSearch(e.target.value)}/>
                  </div>
                  <div className="field">
                    <label htmlFor="admin-user-role">{translate("Filter by role")}</label>
                    <select id="admin-user-role" className="select" value={userRole} onChange={e => setUserRole(e.target.value)}>
                      <option value="all">{translate("All roles")}</option>
                      <option value="customer">{translate("Customers")}</option>
                      <option value="provider">{translate("Providers")}</option>
                      <option value="mechanic">{translate("Mechanic")}</option>
                      <option value="cashier">{translate("Cashier")}</option>
                      <option value="admin">{translate("Administrators")}</option>
                    </select>
                  </div>
                  <div className="admin-user-count" aria-live="polite">
                    {filteredUsers.length}{translate(" of ")}{users.length}{translate(" users")}
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <Empty icon={UserRound} title={translate("No matching users")} text="Try another search term or role filter."/>
                ) : (
                  <div className="card table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{translate("Name")}</th>
                          <th>{translate("Email")}</th>
                          <th>{translate("Phone")}</th>
                          <th>{translate("Role")}</th>
                          <th>{translate("Joined")}</th>
                          <th>{translate("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td><a href={`tel:${u.phone}`} className="inline-link">{u.phone}</a></td>
                            <td><span className={roleBadgeClass(u.role)}>{translate(u.role)}</span></td>
                            <td>{new Date(u.created_at).toLocaleDateString(getDateLocale())}</td>
                            <td>
                              <div className="row-actions">
                                <button className="btn btn-outline btn-small" onClick={() => setEditingUser(u)}>
                                  <Pencil size={14}/>{translate("Edit")}
                                </button>
                                <button className="btn btn-danger btn-small" disabled={u.role === 'admin' || String(u.id) === String(currentUser.id)} onClick={() => deleteUser(u)}>
                                  <Trash2 size={14}/>{translate("Delete")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {/* FINANCIAL REPORTS */}
          <section id="admin-financials" className="admin-section">
            <h2>Financial & Inventory Reports</h2>
            <div className="grid grid-3">
              <div className="card">
                <h3>Total Revenue Collected</h3>
                <div style={{fontSize:28,fontWeight:800,color:'#13835f',margin:'10px 0'}}>
                  {money(report?.payments?.revenue)}
                </div>
                <div className="muted">{report?.payments?.count || 0} total paid transactions</div>
              </div>
              <div className="card">
                <h3>Spare Parts Inventory Value</h3>
                <div style={{fontSize:28,fontWeight:800,color:'#102a43',margin:'10px 0'}}>
                  {money(report?.inventory?.total_value)}
                </div>
                <div className="muted">{report?.inventory?.total_parts || 0} unique items ({report?.inventory?.low_stock || 0} low stock)</div>
              </div>
              <div className="card">
                <h3>Revenue by Payment Method</h3>
                {report?.paymentsByMethod?.length === 0 ? (
                  <p className="muted">No payments recorded yet.</p>
                ) : (
                  <div className="grid" style={{gap:6,marginTop:8}}>
                    {report?.paymentsByMethod?.map(pm => (
                      <div key={pm.method} style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                        <span>{pm.method}:</span>
                        <strong>{money(pm.total_amount)} ({pm.count})</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="admin-complaints" className="admin-section">
            <h2>{translate("Complaints")}</h2>
            {complaints === null ? <LoadBlock/> : complaints.length === 0 ? (
              <p className="muted">{translate("No customer complaints.")}</p>
            ) : (
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Customer</th>
                      <th>Description</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.subject}</strong></td>
                        <td>{c.customer_name}</td>
                        <td>{c.description}</td>
                        <td><Status status={c.status}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div id="admin-operations" className="row-actions admin-section">
            <Link className="btn btn-outline" to="/bookings">{translate("All bookings")}</Link>
            <Link className="btn btn-outline" to="/inventory">{translate("Inventory")}</Link>
            <Link className="btn btn-outline" to="/equipment">{translate("Equipment")}</Link>
            <Link className="btn btn-outline" to="/invoices">{translate("Invoices & Receipts")}</Link>
            <Link className="btn btn-outline" to="/roadside">{translate("Roadside requests")}</Link>
          </div>
        </div>
      </div>
      {editingUser && <AdminUserModal account={editingUser} close={() => setEditingUser(null)} onUpdated={saveUser}/>}
    </Page>
  );
}

function AdminUserModal({ account, close, onUpdated }) {
  const [form, setForm] = useState({ name: account.name, email: account.email, phone: account.phone, role: account.role });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.put(`/admin/users/${account.id}`, form);
      onUpdated(data);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit user · ${account.name}`} close={close}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="admin-user-name">{translate("Name")}</label>
          <input id="admin-user-name" className="input" required minLength="2" maxLength="120" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
        </div>
        <div className="field">
          <label htmlFor="admin-user-email">{translate("Email")}</label>
          <input id="admin-user-email" className="input" type="email" required maxLength="255" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
        </div>
        <div className="field">
          <label htmlFor="admin-user-phone">{translate("Phone")}</label>
          <input id="admin-user-phone" className="input" required minLength="7" maxLength="30" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
        </div>
        <div className="field">
          <label>Role</label>
          <select className="select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="customer">Customer</option>
            <option value="provider">Provider (Workshop)</option>
            <option value="mechanic">Mechanic</option>
            <option value="cashier">Cashier</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <ErrorMessage message={error}/>
        <div className="row-actions">
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="btn btn-outline" onClick={close}>{translate("Cancel")}</button>
        </div>
      </form>
    </Modal>
  );
}

function AdminCatalog({ id }) {
  const { data: categories, error: categoryError, setData: setCategories } = useLoad('/categories', []);
  const { data: services, error: serviceError, setData: setServices } = useLoad('/admin/services', []);
  const [form, setForm] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');

  const addCategory = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const { data } = await api.post('/admin/categories', form);
      setCategories([...(categories || []), data]);
      setForm({ name: '', description: '' });
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  const toggleService = async (service) => {
    try {
      const { data } = await api.patch(`/admin/services/${service.id}`, { active: !service.active });
      setServices(services.map(item => item.id === service.id ? { ...item, ...data } : item));
    } catch (e) {
      setMessage(explainError(e));
    }
  };

  return (
    <section id={id} className="admin-section" style={{marginBottom:30}}>
      <h2>{translate("Catalog management")}</h2>
      <div className="grid grid-3" style={{alignItems:'start'}}>
        <form className="card" onSubmit={addCategory}>
          <h3>{translate("Service categories")}</h3>
          <div className="field">
            <label>{translate("Category name")}</label>
            <input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
          </div>
          <div className="field">
            <label>{translate("Description")}</label>
            <textarea className="textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
          </div>
          <ErrorMessage message={message || categoryError}/>
          <button className="btn">{translate("Add category")}</button>
          <hr style={{border:0,borderTop:'1px solid #edf0f1',margin:'18px 0'}}/>
          {categories?.map(category => (
            <div key={category.id} style={{padding:'8px 0',borderBottom:'1px solid #edf0f1'}}>
              <strong style={{fontSize:13}}>{category.name}</strong>
              <div className="muted" style={{fontSize:12}}>{category.description}</div>
            </div>
          ))}
        </form>

        <div className="card" style={{gridColumn:'span 2'}}>
          <h3>{translate("Repair services")}</h3>
          {serviceError && <ErrorMessage message={serviceError}/>}
          <ErrorMessage message={message}/>
          {services === null ? <LoadBlock/> : services.length === 0 ? (
            <p className="muted">{translate("No provider services have been published yet.")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{translate("Service")}</th>
                    <th>{translate("Provider")}</th>
                    <th>{translate("Category")}</th>
                    <th>{translate("Price")}</th>
                    <th>{translate("Visibility")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id}>
                      <td>{service.name}</td>
                      <td>{service.business_name}</td>
                      <td>{service.category}</td>
                      <td>{money(service.price)}</td>
                      <td><Status status={service.active ? 'Accepted' : 'Rejected'}/></td>
                      <td>
                        <button className="btn btn-outline btn-small" onClick={() => toggleService(service)}>
                          {service.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Profile() {
  const { user } = useAuth();
  if (!user) return <Page title={translate("Profile")}><SignInPrompt/></Page>;

  return (
    <Page title={translate("Your profile")} subtitle="Account details and assigned role.">
      <div className="card form-card">
        <span className={roleBadgeClass(user.role)}>{user.role}</span>
        <h2 style={{marginTop:14}}>{user.name}</h2>
        <p className="muted">{translate("Profile information is associated with your registered account.")}</p>
        <div className="field"><label>{translate("Name")}</label><input className="input" disabled value={user.name}/></div>
        <div className="field"><label>{translate("Email")}</label><input className="input" disabled value={user.email}/></div>
        <div className="field"><label>{translate("Phone")}</label><input className="input" disabled value={user.phone}/></div>
        <a className="btn btn-outline" href={`tel:${user.phone}`}><Activity size={16}/>{translate(" Call my phone")}</a>
      </div>
    </Page>
  );
}

function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: params.get('role') || 'customer',
    businessName: '',
    providerType: 'mechanic',
    location: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate('/dashboard'); }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : {
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
            role: form.role,
            businessName: form.businessName,
            providerType: form.providerType,
            location: form.location
          };
      const { data } = await api.post(`/auth/${isLogin ? 'login' : 'register'}`, payload);
      login(data);
      navigate('/dashboard');
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={isLogin ? 'Welcome back' : 'Create your account'} subtitle={isLogin ? 'Sign in to manage your vehicle services.' : 'Join drivers, mechanics, cashiers, and automotive workshops.'}>
      <form className="card form-card" onSubmit={submit}>
        {!isLogin && (
          <>
            <div className="field">
              <label>{translate("Account type")}</label>
              <select className="select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="customer">{translate("Vehicle owner / Customer")}</option>
                <option value="provider">{translate("Garage / Workshop Provider")}</option>
                <option value="mechanic">{translate("Mechanic")}</option>
                <option value="cashier">{translate("Cashier")}</option>
              </select>
            </div>
            {form.role === 'provider' && (
              <>
                <div className="field"><label>{translate("Business or workshop name")}</label><input className="input" required value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})}/></div>
                <div className="form-grid">
                  <div className="field">
                    <label>{translate("Provider type")}</label>
                    <select className="select" value={form.providerType} onChange={e => setForm({...form, providerType: e.target.value})}>
                      <option value="mechanic">{translate("Mechanic")}</option>
                      <option value="workshop">{translate("Workshop")}</option>
                    </select>
                  </div>
                  <div className="field"><label>{translate("Location")}</label><input className="input" required placeholder={translate("City / area")} value={form.location} onChange={e => setForm({...form, location: e.target.value})}/></div>
                </div>
                <div className="alert alert-success">{translate("Provider listings require administrator verification before becoming visible.")}</div>
              </>
            )}
            <div className="field"><label>{translate("Full name")}</label><input className="input" required minLength="2" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
          </>
        )}
        <div className="field"><label>{translate("Email address")}</label><input className="input" required type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
        {!isLogin && <div className="field"><label>{translate("Phone number")}</label><input className="input" required type="tel" minLength="7" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>}
        <div className="field"><label>{translate("Password")}</label><input className="input" required type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? 1 : 8} value={form.password} onChange={e => setForm({...form, password: e.target.value})}/>{!isLogin && <small className="muted">{translate("Use at least 8 characters.")}</small>}</div>
        <ErrorMessage message={error}/>
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'} <ArrowRight size={15}/></button>
        <p className="muted" style={{marginTop:18,marginBottom:0}}>
          {isLogin ? 'New to DERASHE GERAJI?' : 'Already have an account?'} <Link className="inline-link" to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Log in'}</Link>
        </p>
      </form>
    </Page>
  );
}

function Modal({ title, close, children }) {
  return (
    <div onClick={close} style={{position:'fixed',inset:0,zIndex:60,background:'#102a4370',display:'grid',placeItems:'center',padding:18}}>
      <div className="card" onClick={e => e.stopPropagation()} style={{width:'min(640px,100%)',maxHeight:'90vh',overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{margin:0}}>{translate(title)}</h3>
          <button className="mobile-menu no-print" onClick={close}><X/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="card">
      <p>{translate("Sign in to view this section.")}</p>
      <Link className="btn" to="/login">{translate("Log in ")}<ArrowRight size={15}/></Link>
    </div>
  );
}

function NotFound() {
  return (
    <Page title={translate("Page not found")}>
      <Empty title={translate("This page isn't available")} text="The link may be incorrect or the page may have moved."/>
      <Link className="btn" to="/">{translate("Go home")}</Link>
    </Page>
  );
}

export default App;
