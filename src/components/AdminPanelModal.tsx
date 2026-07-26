import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  RefreshCw, 
  Crown, 
  Sparkles, 
  X,
  AlertTriangle,
  Calendar,
  Lock,
  Phone,
  Mail,
  UserCheck,
  CreditCard,
  Download,
  Upload,
  Database,
  Receipt,
  FileJson,
  Check
} from 'lucide-react';
import { User, PurchaseRequestRecord } from '../types';
import { 
  fetchAdminUsers, 
  updateAdminUserSubscription, 
  createAdminUser, 
  deleteAdminUser,
  fetchAdminPurchaseRequests,
  approveAdminPurchaseRequest,
  rejectAdminPurchaseRequest,
  exportAdminBackup,
  importAdminBackup
} from '../services/api';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  authToken: string;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  authToken
}) => {
  const [adminTab, setAdminTab] = useState<'users' | 'requests' | 'backup'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Purchase Requests State
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  // Backup & Restore State
  const [exportingBackup, setExportingBackup] = useState<boolean>(false);
  const [importingBackup, setImportingBackup] = useState<boolean>(false);
  const [importedJsonText, setImportedJsonText] = useState<string>('');
  const [importFileName, setImportFileName] = useState<string>('');

  // Search and Filters for Users
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Edit / Subscription Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'expired'>('active');
  const [editPlan, setEditPlan] = useState<'free' | 'pro' | 'vip'>('pro');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [selectedDays, setSelectedDays] = useState<number | null>(30);
  const [customDaysInput, setCustomDaysInput] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);

  // Add User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPlan, setNewPlan] = useState<'free' | 'pro' | 'vip'>('pro');
  const [newDays, setNewDays] = useState<number>(30);
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false);

  // Delete User Confirm
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(authToken);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگیری لیست کاربران');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseRequests = async () => {
    if (!authToken) return;
    setLoadingRequests(true);
    try {
      const data = await fetchAdminPurchaseRequests(authToken);
      setPurchaseRequests(data || []);
    } catch (err: any) {
      console.error('Error loading purchase requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isOpen && authToken) {
      loadUsers();
      loadPurchaseRequests();
    }
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  // Calculate statistics
  const totalUsers = users.length;
  const activeSubs = users.filter((u) => u.subscriptionStatus === 'active' || u.role === 'admin').length;
  const inactiveSubs = users.filter((u) => u.subscriptionStatus === 'inactive' || u.subscriptionStatus === 'expired').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const pendingRequestsCount = purchaseRequests.filter((r) => r.status === 'pending').length;

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q || 
      u.username.toLowerCase().includes(q) || 
      (u.fullName && u.fullName.toLowerCase().includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));

    const matchesStatus = statusFilter === 'all' || u.subscriptionStatus === statusFilter;
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Calculate remaining days for user
  const getRemainingDaysText = (user: User) => {
    if (user.role === 'admin' || !user.subscriptionExpireAt) {
      return { text: 'نامحدود (دائمی)', color: 'text-amber-300 font-bold', badgeBg: 'bg-amber-500/10 border-amber-500/30' };
    }
    const expireTime = new Date(user.subscriptionExpireAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0 || user.subscriptionStatus === 'expired') {
      return { text: 'منقضی شده', color: 'text-amber-400 font-bold', badgeBg: 'bg-amber-500/10 border-amber-500/30' };
    }
    return { text: `${diffDays} روز باقی‌مانده`, color: 'text-blue-400 font-bold', badgeBg: 'bg-blue-500/10 border-blue-500/30' };
  };

  // Open Edit Dialog
  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditStatus(user.subscriptionStatus || 'active');
    setEditPlan((user.plan as any) || 'pro');
    setEditRole(user.role || 'user');
    setSelectedDays(30);
    setCustomDaysInput('');
  };

  // Quick toggle user status
  const handleToggleStatus = async (user: User) => {
    const newSt = user.subscriptionStatus === 'active' ? 'inactive' : 'active';
    try {
      setSuccessMsg(null);
      await updateAdminUserSubscription(authToken, user.id, {
        subscriptionStatus: newSt,
        role: user.role,
        plan: user.plan
      });
      setSuccessMsg(`وضعیت کاربر ${user.username} با موفقیت به ${newSt === 'active' ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در ویرایش وضعیت کاربر');
    }
  };

  // Submit User Edit
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSubmittingEdit(true);
    setSuccessMsg(null);
    setError(null);

    let days = selectedDays;
    if (selectedDays === null && customDaysInput) {
      days = parseInt(customDaysInput, 10) || 30;
    }

    try {
      await updateAdminUserSubscription(authToken, editingUser.id, {
        subscriptionStatus: editStatus,
        role: editRole,
        plan: editPlan,
        durationDays: days !== null ? days : undefined
      });

      setSuccessMsg(`اشتراک و دسترسی کاربر ${editingUser.username} با موفقیت بروزرسانی شد.`);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در ذخیره تغییرات کاربر');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      setError('نام کاربری و رمز عبور الزامی است.');
      return;
    }

    setSubmittingAdd(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createAdminUser(authToken, {
        username: newUsername,
        fullName: newFullName,
        email: newEmail,
        phone: newPhone,
        password: newPassword,
        role: newRole,
        plan: newPlan,
        extendDays: newDays
      });

      setSuccessMsg(`کاربر جدید (${newUsername}) با موفقیت ایجاد گردید.`);
      setIsAddUserOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در ایجاد کاربر جدید');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    try {
      setSuccessMsg(null);
      await deleteAdminUser(authToken, userId);
      setSuccessMsg('کاربر با موفقیت از سیستم حذف شد.');
      setDeletingUserId(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در حذف کاربر');
    }
  };

  // Purchase Request Handlers
  const handleApproveRequest = async (requestId: string) => {
    if (!authToken) return;
    setProcessingReqId(requestId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await approveAdminPurchaseRequest(authToken, requestId);
      setSuccessMsg(res.message || 'درخواست خرید تایید و اشتراک کاربر فعال گردید.');
      await loadPurchaseRequests();
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در تایید درخواست');
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!authToken) return;
    setProcessingReqId(requestId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await rejectAdminPurchaseRequest(authToken, requestId, 'رد توسط مدیر سیستم');
      setSuccessMsg(res.message || 'درخواست خرید رد شد.');
      await loadPurchaseRequests();
    } catch (err: any) {
      setError(err.message || 'خطا در رد درخواست');
    } finally {
      setProcessingReqId(null);
    }
  };

  // Backup Handlers
  const handleExportBackup = async () => {
    if (!authToken) return;
    setExportingBackup(true);
    setError(null);
    try {
      const backupData = await exportAdminBackup(authToken);
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autorun_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg('فایل بکاپ کامل سیستم با موفقیت ایجاد و دانلود شد.');
    } catch (err: any) {
      setError(err.message || 'خطا در دانلود بکاپ سیستم');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportedJsonText(content || '');
    };
    reader.readAsText(file);
  };

  const handleImportBackup = async () => {
    if (!authToken || !importedJsonText.trim()) return;
    if (!window.confirm('آیا اطمینان دارید؟ با بازیابی بکاپ، تمامی اطلاعات فعلی با داده‌های فایل جدید جایگزین شده و اتصالات به سرور جدید منتقل می‌شوند.')) return;

    setImportingBackup(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const parsed = JSON.parse(importedJsonText);
      const res = await importAdminBackup(authToken, parsed);
      setSuccessMsg(res.message || 'بکاپ با موفقیت بازیابی شد.');
      await loadUsers();
      await loadPurchaseRequests();
      setImportedJsonText('');
      setImportFileName('');
    } catch (err: any) {
      setError(err.message || 'فرمت فایل بکاپ نامعتبر است یا در فرایند بازیابی خطایی رخ داد.');
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 font-sans dir-rtl overflow-hidden animate-fade-in admin-modal-container">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                پنل مدیریت ارشد سیستم
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold">
                  دسترسی طلایی
                </span>
              </h2>
              <p className="text-xs text-slate-400">کنترل کامل کاربران، فاکتورهای واریزی و پشتیبان‌گیری کل سرور</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadUsers(); loadPurchaseRequests(); }}
              disabled={loading || loadingRequests}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="بروزرسانی اطلاعات"
            >
              <RefreshCw className={`w-4 h-4 ${loading || loadingRequests ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">بروزرسانی</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setAdminTab('users')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              adminTab === 'users'
                ? 'bg-slate-800 text-amber-300 border-t border-x border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>مدیریت کاربران</span>
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-700 text-white font-mono">
              {totalUsers}
            </span>
          </button>

          <button
            onClick={() => setAdminTab('requests')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              adminTab === 'requests'
                ? 'bg-slate-800 text-amber-300 border-t border-x border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>درخواست‌های خرید و واریز</span>
            {pendingRequestsCount > 0 ? (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse">
                {pendingRequestsCount} جدید
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-700 text-slate-300 font-mono">
                {purchaseRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAdminTab('backup')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              adminTab === 'backup'
                ? 'bg-slate-800 text-amber-300 border-t border-x border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-blue-400" />
            <span>بکاپگیری و انتقال کامل سرور</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">

          {/* TAB 1: USER MANAGEMENT */}
          {adminTab === 'users' && (
            <div className="space-y-5">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">کل کاربران ثبت‌نامی</span>
                    <span className="text-lg font-black text-white">{totalUsers}</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">اشتراک‌های فعال</span>
                    <span className="text-lg font-black text-emerald-400">{activeSubs}</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">غیرفعال / منقضی</span>
                    <span className="text-lg font-black text-amber-400">{inactiveSubs}</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">مدیران ارشد سیستم</span>
                    <span className="text-lg font-black text-purple-300">{adminCount}</span>
                  </div>
                </div>
              </div>

              {/* Search, Filters, Add User Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو در نام، نام کاربری، ایمیل یا شماره..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="active">اشتراک فعال</option>
                    <option value="inactive">اشتراک غیرفعال</option>
                    <option value="expired">منقضی شده</option>
                  </select>

                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">همه پلن‌ها</option>
                    <option value="free">رایگان (Free)</option>
                    <option value="pro">حرفه‌ای (PRO)</option>
                    <option value="vip">ویژه (VIP)</option>
                  </select>

                  <button
                    onClick={() => setIsAddUserOpen(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ایجاد کاربر جدید</span>
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-slate-950/60 rounded-2xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold">
                      <th className="p-3.5">کاربر</th>
                      <th className="p-3.5">اطلاعات تماس</th>
                      <th className="p-3.5">نقش</th>
                      <th className="p-3.5">پلن</th>
                      <th className="p-3.5">وضعیت اشتراک</th>
                      <th className="p-3.5">اعتبار باقی‌مانده</th>
                      <th className="p-3.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                          <span>در حال دریافت لیست کاربران...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          هیچ کاربری با مشخصات جستجو شده یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const remaining = getRemainingDaysText(user);
                        const isAdminUser = user.role === 'admin';

                        return (
                          <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* User Info */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isAdminUser 
                                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-sm'
                                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                                }`}>
                                  {user.fullName ? user.fullName.charAt(0) : user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-white block">
                                    {user.fullName || user.username}
                                  </span>
                                  <span className="text-[11px] text-slate-400 dir-ltr font-mono">
                                    @{user.username}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td className="p-3.5 text-slate-300 text-[11px]">
                              <div>{user.email || '-'}</div>
                              <div className="text-slate-400 dir-ltr font-mono">{user.phone || '-'}</div>
                            </td>

                            {/* Role */}
                            <td className="p-3.5">
                              {isAdminUser ? (
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 w-max">
                                  <Shield className="w-3 h-3 text-purple-400" />
                                  مدیر سیستم
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">
                                  کاربر معمولی
                                </span>
                              )}
                            </td>

                            {/* Plan */}
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                isAdminUser
                                  ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-400/40 shadow-sm'
                                  : user.plan === 'vip' 
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                  : user.plan === 'pro'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isAdminUser ? '👑 دسترسی طلایی' : user.plan === 'vip' ? 'VIP' : user.plan === 'pro' ? 'Pro' : 'رایگان'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="p-3.5">
                              {isAdminUser || user.subscriptionStatus === 'active' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  فعال
                                </span>
                              ) : user.subscriptionStatus === 'expired' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  منقضی شده
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px]">
                                  غیرفعال
                                </span>
                              )}
                            </td>

                            {/* Remaining Days */}
                            <td className="p-3.5">
                              <span className={`text-[11px] px-2.5 py-1 rounded-lg border ${remaining.badgeBg} ${remaining.color}`}>
                                {remaining.text}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(user)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition-all cursor-pointer"
                                  title="تمدید اشتراک / تغییر سطح دسترسی"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    user.subscriptionStatus === 'active'
                                      ? 'bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border-slate-700'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  }`}
                                  title={user.subscriptionStatus === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی سریع'}
                                >
                                  {user.subscriptionStatus === 'active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>

                                {currentUser?.id !== user.id && (
                                  <button
                                    onClick={() => setDeletingUserId(user.id)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 transition-all cursor-pointer"
                                    title="حذف کاربر"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PURCHASE REQUESTS & DEPOSITS */}
          {adminTab === 'requests' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    لیست فاکتورها و درخواست‌های کارت به کارت
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    درخواست‌های ارتقا به همراه ۴ رقم آخر کارت یا کدهای پیگیری واریزی کاربران
                  </p>
                </div>
                <button
                  onClick={loadPurchaseRequests}
                  disabled={loadingRequests}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
                  <span>بروزرسانی</span>
                </button>
              </div>

              {loadingRequests ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
                  <span>در حال دریافت لیست درخواست‌ها...</span>
                </div>
              ) : purchaseRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                  هیچ درخواستی تاکنون ثبت نشده است.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {purchaseRequests.map((reqItem) => {
                    const isPending = reqItem.status === 'pending';
                    const isApproved = reqItem.status === 'approved';
                    const isRejected = reqItem.status === 'rejected';

                    return (
                      <div 
                        key={reqItem.id} 
                        className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                          isPending 
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5' 
                            : isApproved
                            ? 'bg-slate-900/60 border-emerald-500/30'
                            : 'bg-slate-900/40 border-red-500/20 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
                          <div>
                            <span className="text-xs font-black text-white block">
                              کاربر: {reqItem.fullName || reqItem.username} (@{reqItem.username})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              شماره تماس / ایمیل: {reqItem.userPhone || reqItem.userEmail || 'ثبت نشده'}
                            </span>
                          </div>

                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                            isPending 
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {isPending ? 'در انتظار بررسی' : isApproved ? 'تایید شده ✓' : 'رد شده ✕'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                            <span className="text-slate-400 text-[10px] block">پلن درخواستی:</span>
                            <span className="font-bold text-amber-300">{reqItem.planTitle} ({reqItem.billingCycleMonths} ماهه)</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                            <span className="text-slate-400 text-[10px] block">روش پرداخت:</span>
                            <span className="font-bold text-slate-200">
                              {reqItem.paymentMethod === 'card_to_card' ? 'کارت به کارت' : 'درگاه پرداخت'}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-xs flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">۴ رقم آخر کارت / کد پیگیری:</span>
                          <span className="font-mono text-sm font-black text-amber-300 tracking-widest dir-ltr">
                            {reqItem.transactionId || 'ثبت نشده'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>تاریخ ثبت: {new Date(reqItem.createdAt).toLocaleDateString('fa-IR')}</span>
                          {isPending && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveRequest(reqItem.id)}
                                disabled={processingReqId === reqItem.id}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg transition-all cursor-pointer shadow-md"
                              >
                                {processingReqId === reqItem.id ? '...' : 'تایید فیش'}
                              </button>
                              <button
                                onClick={() => handleRejectRequest(reqItem.id)}
                                disabled={processingReqId === reqItem.id}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold rounded-lg transition-all cursor-pointer"
                              >
                                رد
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BACKUP & SERVER MIGRATION */}
          {adminTab === 'backup' && (
            <div className="space-y-6">
              
              {/* Export Backup Section */}
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">۱. دانلود بکاپ کاربران و کانال‌ها (خروجی)</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      از تمامی اطلاعات اعضا (یوزرنیم، رمزهای عبور، ایمیل)، توکن‌های ربات بله، اتصالات کانال‌های اعضا، تنظیمات و لایسنس‌ها فایل JSON دریافت کنید. برای سبک بودن فایل، تاریخچه پیام‌های قبلی کانال‌ها استخراج نمی‌شود.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleExportBackup}
                    disabled={exportingBackup}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className={`w-4 h-4 ${exportingBackup ? 'animate-bounce' : ''}`} />
                    <span>{exportingBackup ? 'در حال ایجاد فایل بکاپ...' : 'دانلود فایل بکاپ کامل (JSON)'}</span>
                  </button>
                </div>
              </div>

              {/* Import Backup Section */}
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-200">۲. بازیابی و انتقال داده‌ها به سرور جدید (ایمپورت)</h3>
                    <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                      فایل بکاپ JSON دانلود شده از سرور قبلی را انتخاب کرده و روی «اعمال و بازیابی کامل» کلیک کنید. تمامی کانال‌ها و کاربران فوراً روی این سرور متصل خواهند شد.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-white/20 cursor-pointer flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-amber-400" />
                      <span>{importFileName ? importFileName : 'انتخاب فایل بکاپ (autorun_backup.json)'}</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {importedJsonText && (
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" /> فایل با موفقیت خوانده شد ({importedJsonText.length} کاراکتر)
                      </span>
                    )}
                  </div>

                  {importedJsonText && (
                    <button
                      onClick={handleImportBackup}
                      disabled={importingBackup}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Database className="w-4 h-4" />
                      <span>{importingBackup ? 'در حال بازیابی اطلاعات...' : 'تایید و بازیابی کامل روی سرور جدید'}</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal: Edit User / Subscription */}
        {editingUser && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4 animate-fade-in dir-rtl admin-modal-subdialog">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  مدیریت کاربر: {editingUser.username}
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">نقش دسترسی:</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="user">کاربر معمولی</option>
                    <option value="admin">مدیر سیستم (Admin - دسترسی طلایی)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">پلن اشتراک:</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="free">رایگان (Free)</option>
                    <option value="pro">حرفه‌ای (PRO)</option>
                    <option value="vip">ویژه (VIP)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">وضعیت اشتراک:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                    <option value="expired">منقضی شده</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">افزایش/تمدید اعتیار (روز):</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '+۳۰ روز', value: 30 },
                      { label: '+۹۰ روز', value: 90 },
                      { label: '+۱ سال', value: 365 },
                      { label: 'دائم', value: 3650 },
                    ].map((btn) => (
                      <button
                        key={btn.value}
                        type="button"
                        onClick={() => { setSelectedDays(btn.value); setCustomDaysInput(''); }}
                        className={`p-2 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          selectedDays === btn.value 
                            ? 'bg-amber-500 text-slate-950 border-amber-400' 
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={submittingEdit}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  {submittingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add User */}
        {isAddUserOpen && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4 animate-fade-in dir-rtl admin-modal-subdialog">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-400" />
                  ایجاد کاربر جدید
                </h3>
                <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">نام کاربری (*):</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">رمز عبور (*):</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">نام کامل:</label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">پلن:</label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                    >
                      <option value="pro">حرفه‌ای (PRO)</option>
                      <option value="vip">ویژه (VIP)</option>
                      <option value="free">رایگان (Free)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">اعتبار (روز):</label>
                    <input
                      type="number"
                      value={newDays}
                      onChange={(e) => setNewDays(parseInt(e.target.value, 10) || 30)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingAdd}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {submittingAdd ? 'در حال ساخت...' : 'ساخت کاربر'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Confirm Delete */}
        {deletingUserId && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center animate-fade-in dir-rtl admin-modal-subdialog">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">تایید حذف کاربر</h3>
              <p className="text-xs text-slate-400">آیا از حذف این کاربر از سیستم اطمینان دارید؟ این عمل غیرقابل بازگشت است.</p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleDeleteUser(deletingUserId)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  بله، حذف کن
                </button>
                <button
                  onClick={() => setDeletingUserId(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
