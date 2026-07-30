import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Sparkles, 
  Zap, 
  Check, 
  X, 
  Clock, 
  Gift, 
  CreditCard, 
  Send, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ChevronLeft,
  Tag,
  Star,
  Users
} from 'lucide-react';
import { User, SubscriptionPlan, PurchaseRequestDTO } from '../types';
import { fetchSubscriptionPlans, redeemGiftCode, submitPurchaseRequest } from '../services/api';

interface SubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  authToken: string;
  onUserUpdated: (user: User) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const SubscriptionsModal: React.FC<SubscriptionsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  authToken,
  onUserUpdated,
  onOpenAuth,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'my_subscription' | 'redeem'>('plans');

  // Billing Cycle (Months)
  const [billingCycle, setBillingCycle] = useState<number>(1); // 1, 3, 6, 12

  // Selected Plan for Checkout
  const [selectedPlanId, setSelectedPlanId] = useState<'pro' | 'vip'>('pro');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card_to_card' | 'online_gateway' | 'telegram_support'>('card_to_card');
  const [transactionIdInput, setTransactionIdInput] = useState<string>('');
  const [submittingPurchase, setSubmittingPurchase] = useState<boolean>(false);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [promoStatusMsg, setPromoStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [submittingCode, setSubmittingCode] = useState<boolean>(false);

  // General Status Messages
  const [noticeMsg, setNoticeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCard, setCopiedCard] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await fetchSubscriptionPlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load subscription plans:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Calculate discount multiplier
  const getCycleDiscountPercent = (months: number) => {
    if (months === 3) return 15;
    if (months === 6) return 25;
    if (months === 12) return 40;
    return 0;
  };

  const calculateFinalPrice = (monthlyPrice: number, months: number) => {
    const rawTotal = monthlyPrice * months;
    const cycleDiscount = getCycleDiscountPercent(months);
    const totalDiscountPercent = Math.min(90, cycleDiscount + appliedDiscountPercent);
    const finalPrice = rawTotal * (1 - totalDiscountPercent / 100);
    return Math.round(finalPrice);
  };

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    if (!authToken) {
      setPromoStatusMsg({ type: 'error', text: 'لطفاً برای اعمال کد تخفیف وارد حساب شوید.' });
      return;
    }

    setSubmittingCode(true);
    setPromoStatusMsg(null);
    try {
      const res = await redeemGiftCode(authToken, promoCodeInput.trim());
      if (res.discountPercent) {
        setAppliedDiscountPercent(res.discountPercent);
        setPromoStatusMsg({ type: 'success', text: res.message });
      } else if (res.user) {
        onUserUpdated(res.user);
        setPromoStatusMsg({ type: 'success', text: res.message });
        setPromoCodeInput('');
      } else {
        setPromoStatusMsg({ type: 'success', text: res.message });
      }
    } catch (err: any) {
      setPromoStatusMsg({ type: 'error', text: err.message || 'کد وارد شده نامعتبر است.' });
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!authToken) {
      onOpenAuth('login');
      return;
    }

    setSubmittingPurchase(true);
    setNoticeMsg(null);

    const selectedPlanObj = plans.find((p) => p.id === selectedPlanId);
    const monthlyPrice = selectedPlanObj ? selectedPlanObj.priceMonthly : 149000;
    const finalPrice = calculateFinalPrice(monthlyPrice, billingCycle);

    const dto: PurchaseRequestDTO = {
      planId: selectedPlanId,
      billingCycleMonths: billingCycle,
      paymentMethod,
      transactionId: transactionIdInput.trim() || undefined,
      promoCode: promoCodeInput.trim() || undefined,
      amountPaid: finalPrice,
    };

    try {
      const res = await submitPurchaseRequest(authToken, dto);
      onUserUpdated(res.user);
      setNoticeMsg({ type: 'success', text: res.message });
      setIsCheckoutOpen(false);
      setActiveTab('my_subscription');
    } catch (err: any) {
      setNoticeMsg({ type: 'error', text: err.message || 'خطا در ثبت سفارش خرید' });
    } finally {
      setSubmittingPurchase(false);
    }
  };

  // Helper for remaining subscription days
  const getDaysRemaining = () => {
    if (!currentUser) return 0;
    if (currentUser.role === 'admin' || !currentUser.subscriptionExpireAt) return 'نامحدود (دائمی)';
    const expireDate = new Date(currentUser.subscriptionExpireAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const copyCardToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 text-slate-100 flex flex-col shadow-2xl dir-rtl">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl text-amber-400 bg-amber-500/10 border border-amber-500/20">
              <Crown className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">تعرفه‌ها و پلن‌های اشتراک</h2>
              <p className="text-xs text-slate-300 mt-0.5">ارتقای سطح کاربری برای دسترسی به هوش مصنوعی و کانال‌های بیشتر</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Notice Alert */}
        {noticeMsg && (
          <div className={`mx-6 mt-4 p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            noticeMsg.type === 'success' 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
              : 'bg-red-500/20 border-red-500/40 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {noticeMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="leading-relaxed">{noticeMsg.text}</span>
            </div>
            <button onClick={() => setNoticeMsg(null)} className="text-xs opacity-70 hover:opacity-100 p-1">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => { setActiveTab('plans'); setIsCheckoutOpen(false); }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'plans' && !isCheckoutOpen
                ? 'bg-amber-500/20 text-amber-300 border-t border-x border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>پلن‌های اشتراک</span>
          </button>

          <button
            onClick={() => { setActiveTab('my_subscription'); setIsCheckoutOpen(false); }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'my_subscription'
                ? 'bg-amber-500/20 text-amber-300 border-t border-x border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>اشتراک فعال من</span>
            {currentUser && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40">
                {currentUser.role === 'admin' ? 'دسترسی طلایی' : (currentUser.plan?.toUpperCase() || 'FREE')}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('redeem'); setIsCheckoutOpen(false); }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'redeem'
                ? 'bg-amber-500/20 text-amber-300 border-t border-x border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>کد هدیه و تخفیف</span>
          </button>
        </div>

        {/* Main Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">

          {/* TAB 1: PLANS SHOWCASE & CHECKOUT */}
          {activeTab === 'plans' && !isCheckoutOpen && (
            <div className="space-y-6">
              
              {currentUser?.role === 'admin' && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3 shadow-lg shadow-amber-500/5">
                  <Crown className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                  <div>
                    <span className="font-extrabold text-amber-300 block text-sm">👑 دسترسی طلایی مدیر ارشد سیستم</span>
                    <span className="text-[11px] text-amber-200/90">شما دارای دسترسی کامل و نامحدود به تمامی امکانات، ارسال دوگانه بله، بازنویسی هوشمند هوش مصنوعی و اتصالات همزمان هستید.</span>
                  </div>
                </div>
              )}
              
              {/* Billing Cycle Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div>
                  <h4 className="text-xs font-black text-white">دوره تمدید و فاکتور:</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">با انتخاب دوره‌های طولانی‌تر تا ۴۰٪ تخفیف ویژه دریافت کنید.</p>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                  {[
                    { months: 1, label: '۱ ماهه', discount: null },
                    { months: 3, label: '۳ ماهه', discount: '۱۵٪-' },
                    { months: 6, label: '۶ ماهه', discount: '۲۵٪-' },
                    { months: 12, label: '۱ ساله', discount: '۴۰٪-' },
                  ].map((cycle) => (
                    <button
                      key={cycle.months}
                      onClick={() => setBillingCycle(cycle.months)}
                      className={`relative px-3.5 py-2 rounded-lg transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                        billingCycle === cycle.months
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md border border-amber-400'
                          : 'bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{cycle.label}</span>
                      {cycle.discount && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                          billingCycle === cycle.months 
                            ? 'bg-slate-950 text-amber-300 border border-amber-400' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {cycle.discount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((plan) => {
                  const finalPrice = calculateFinalPrice(plan.priceMonthly, billingCycle);
                  const isCurrentPlan = currentUser?.plan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl p-5 flex flex-col justify-between transition-all border ${
                        plan.recommended
                          ? 'neu-flat border-amber-500/40 bg-slate-900/80 shadow-xl shadow-amber-500/5 scale-102'
                          : 'neu-inset border-white/10 bg-slate-900/30 hover:border-white/20'
                      }`}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-950 text-amber-300 border border-amber-500/50 font-extrabold text-[10px] shadow-lg flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{plan.badge}</span>
                        </div>
                      )}

                      <div>
                        {/* Title & Description */}
                        <div className="text-center pt-2 pb-4 border-b border-white/10">
                          <h3 className="text-lg font-black text-white">{plan.name}</h3>
                          <p className="text-[11px] text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>
                        </div>

                        {/* Price Tag */}
                        <div className="my-5 text-center">
                          {plan.priceMonthly === 0 ? (
                            <div className="text-2xl font-black text-emerald-400">رایگان</div>
                          ) : (
                            <div>
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-2xl font-black text-amber-300">
                                  {finalPrice.toLocaleString('fa-IR')}
                                </span>
                                <span className="text-xs text-slate-400">تومان</span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                به ازای {billingCycle} ماه {getCycleDiscountPercent(billingCycle) > 0 && `(${getCycleDiscountPercent(billingCycle)}٪ تخفیف)`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Feature Checklist */}
                        <ul className="space-y-2.5 my-4 text-xs">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-slate-300">
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6 pt-4 border-t border-white/10">
                        {plan.id === 'free' ? (
                          <div className="text-center text-xs text-slate-400 font-bold p-2.5 neu-inset rounded-xl">
                            پلن پایه سیستم
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedPlanId(plan.id as 'pro' | 'vip');
                              setIsCheckoutOpen(true);
                            }}
                            className={`w-full py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                              plan.recommended
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow-amber-500/10'
                                : 'bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-500/40 shadow-blue-500/10'
                            }`}
                          >
                            <Crown className="w-4 h-4" />
                            <span>{isCurrentPlan ? 'تمدید / ارتقا اشتراک' : 'انتخاب و پرداخت'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* CHECKOUT STEP MODAL */}
          {activeTab === 'plans' && isCheckoutOpen && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                  <span>بازگشت به لیست پلن‌ها</span>
                </button>
                <div className="text-xs text-slate-400 font-bold">
                  فاکتور خرید اشتراک {selectedPlanId.toUpperCase()} ({billingCycle} ماهه)
                </div>
              </div>

              {/* Order Summary & Pricing Details */}
              <div className="p-5 rounded-2xl neu-inset bg-slate-950/60 border border-white/10 space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>پلن انتخابی:</span>
                  <span className="font-bold text-white text-sm">
                    {selectedPlanId === 'vip' ? 'طلایی (VIP / ویژه)' : 'نقره‌ای (PRO / حرفه‌ای)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>مدت زمان:</span>
                  <span className="font-bold text-yellow-400">{billingCycle} ماهه</span>
                </div>
                {getCycleDiscountPercent(billingCycle) > 0 && (
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>تخفیف دوره تمدید ({getCycleDiscountPercent(billingCycle)}٪):</span>
                    <span className="font-bold">اعمال شد ✓</span>
                  </div>
                )}
                {appliedDiscountPercent > 0 && (
                  <div className="flex justify-between items-center text-purple-400">
                    <span>کد تخفیف ویژه ({appliedDiscountPercent}٪):</span>
                    <span className="font-bold">اعمال شد ✓</span>
                  </div>
                )}
                <div className="pt-3 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-200">مبلغ قابل پرداخت:</span>
                  <span className="text-xl font-black text-amber-400">
                    {calculateFinalPrice(
                      plans.find((p) => p.id === selectedPlanId)?.priceMonthly || 149000,
                      billingCycle
                    ).toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-200 block">روش پرداخت:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'card_to_card', title: 'کارت به کارت', desc: 'واریز به شماره کارت شبا و ثبت فیش' },
                    { id: 'online_gateway', title: 'درگاه مستقیم', desc: 'پرداخت سریع با تمام کارت‌های شتاب' },
                    { id: 'telegram_support', title: 'پشتیبانی تلگرام', desc: 'ارسال پیام مستقیم به پشتیبان' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer border ${
                        paymentMethod === m.id
                          ? 'neu-flat border-yellow-400/50 bg-yellow-400/10 text-white font-bold'
                          : 'neu-inset border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-black text-yellow-400">{m.title}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card To Card Box */}
              {paymentMethod === 'card_to_card' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold">شماره کارت جهت واریز:</span>
                    <button
                      onClick={() => copyCardToClipboard('5041721241958751')}
                      className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/30 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCard ? 'کپی شد!' : 'کپی شماره کارت'}</span>
                    </button>
                  </div>
                  <div className="text-center font-mono text-base font-black text-amber-300 tracking-wider dir-ltr">
                    5041 - 7212 - 4195 - 8751
                  </div>
                  <div className="text-[11px] text-slate-300 text-center font-bold">
                    بانک رسالت - امیرحسین نیک صفت نوپاشانی
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      چهار رقم آخر شماره کارت شما (جهت پیگیری واریز):
                    </label>
                    <input
                      type="text"
                      placeholder="۴ رقم آخر کارت خود را بنویسید (مثال: ۵۷۵۱)"
                      value={transactionIdInput}
                      onChange={(e) => setTransactionIdInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
              )}

              {/* Submit Payment Button */}
              <div className="pt-2">
                <button
                  onClick={handleConfirmPurchase}
                  disabled={submittingPurchase}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  <Crown className="w-4 h-4" />
                  <span>{submittingPurchase ? 'در حال ثبت درخواست...' : 'تایید نهایی و تمدید اشتراک'}</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: MY ACTIVE SUBSCRIPTION */}
          {activeTab === 'my_subscription' && (
            <div className="space-y-6">
              {currentUser ? (
                <div className="space-y-6">
                  
                  {/* Active Status Card */}
                  <div className="p-6 rounded-3xl neu-flat border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 text-slate-100 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="p-3 neu-inset rounded-2xl text-amber-400 bg-amber-500/20 border border-amber-400/30">
                          <Crown className="w-8 h-8 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-white">
                              {currentUser.role === 'admin' ? 'سطح دسترسی: مدیر ارشد (دسترسی طلایی)' : `پلن ${currentUser.plan?.toUpperCase() || 'FREE'}`}
                            </h3>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              {currentUser.role === 'admin' ? 'نامحدود دائمی ✓' : (currentUser.subscriptionStatus === 'active' ? 'فعال ✓' : 'منقضی شده ✕')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            کاربر: <span className="text-amber-300 font-bold">{currentUser.fullName || currentUser.username}</span> (@{currentUser.username})
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">زمان باقی‌مانده:</span>
                        <span className="text-lg font-black text-amber-400">
                          {typeof getDaysRemaining() === 'number' ? `${getDaysRemaining()} روز دیگر` : getDaysRemaining()}
                        </span>
                      </div>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 neu-inset rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[10px] block">سقف اتصالات فعال:</span>
                        <span className="text-sm font-black text-yellow-400">{currentUser.maxConnections || 10} کانال</span>
                      </div>
                      <div className="p-3 neu-inset rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[10px] block">هوش مصنوعی AI:</span>
                        <span className="text-sm font-black text-emerald-400">دسترسی کامل ✓</span>
                      </div>
                      <div className="p-3 neu-inset rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[10px] block">ویس و ویس ویدیو:</span>
                        <span className="text-sm font-black text-blue-400">فعال ✓</span>
                      </div>
                      <div className="p-3 neu-inset rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[10px] block">پشتیبانی:</span>
                        <span className="text-sm font-black text-purple-300">۲۴/۷ اختصاصی</span>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => { setActiveTab('plans'); setIsCheckoutOpen(false); }}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>تمدید یا ارتقای پلن</span>
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center neu-inset rounded-3xl border border-white/10 space-y-4">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto animate-bounce" />
                  <h3 className="text-base font-bold text-white">برای مشاهده وضعیت اشتراک وارد حساب خود شوید</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    جهت مشاهده تعداد روزهای باقی‌مانده و لایسنس فعال خود، ابتدا وارد حساب کاربر شوید یا ثبت‌نام کنید.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => { onClose(); onOpenAuth('login'); }}
                      className="px-5 py-2.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs hover:bg-yellow-300 transition-all cursor-pointer"
                    >
                      ورود به حساب
                    </button>
                    <button
                      onClick={() => { onClose(); onOpenAuth('register'); }}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-black text-xs hover:bg-purple-500 transition-all cursor-pointer"
                    >
                      ثبت نام رایگان
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REDEEM PROMO & GIFT CODES */}
          {activeTab === 'redeem' && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl neu-flat border border-purple-500/30 bg-purple-500/5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 neu-inset rounded-2xl text-purple-400 bg-purple-500/20">
                    <Gift className="w-7 h-7 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">فعال‌سازی کد هدیه یا کوپن تخفیف</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      اگر کد هدیه یا کد تخفیف اختصاصی دریافت کرده‌اید، آن را در کادر زیر وارد کنید.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <input
                    type="text"
                    placeholder="کد هدیه (مثال: AUTORUN یا VIP30DAYS)"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-purple-400 font-mono tracking-wider text-center sm:text-right dir-ltr"
                  />
                  <button
                    onClick={handleApplyPromoCode}
                    disabled={submittingCode || !promoCodeInput.trim()}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg"
                  >
                    <Tag className="w-4 h-4" />
                    <span>{submittingCode ? 'در حال بررسی...' : 'اعمال کد'}</span>
                  </button>
                </div>

                {promoStatusMsg && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    promoStatusMsg.type === 'success'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
                  }`}>
                    {promoStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{promoStatusMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Sample Promo Codes Hint Box */}
              <div className="p-4 rounded-2xl neu-inset border border-white/5 text-xs space-y-2">
                <span className="font-bold text-yellow-400 block">💡 کدهای تست فعال جهت هدیه:</span>
                <ul className="space-y-1.5 text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">AUTORUN2026</span>
                    <span>- فعال‌سازی ۳۰ روز اشتراک هدیه رایگان (PRO)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">VIP30DAYS</span>
                    <span>- فعال‌سازی ۳۰ روز اشتراک طلایی (VIP)</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 px-6">
          <span>پشتیبانی تلگرام اتوران: <strong className="text-yellow-400 dir-ltr inline-block">@AutoRunSupport</strong></span>
          <span className="text-slate-400">ضمانت بازگشت وجه تا ۷ روز در صورت عدم رضایت</span>
        </div>

      </div>
    </div>
  );
};
